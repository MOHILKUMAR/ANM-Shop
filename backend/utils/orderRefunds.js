const mongoose = require('mongoose');
const Order = require('../model/Order');
const Product = require('../model/Product');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
const PaymentIntent = require('../model/PaymentIntent');
const Review = require('../model/Review');
const User = require('../model/User');
const sendEmail = require('./sendEmail');
const { getRazorpay } = require('./razorpayClient');
const { shortCode } = require('./orderLookup');

// Which statuses each action applies to: a customer or admin cancels an order that hasn't
// shipped; an admin marks a shipped or delivered order as returned.
const CLOSABLE = { cancel: ['pending'], return: ['shipped', 'delivered'] };
const CLOSED_STATUS = { cancel: 'cancelled', return: 'returned' };
// A refund still "pending" after this long was interrupted (e.g. a restart) and may be retried.
const STUCK_REFUND_MS = 10 * 60 * 1000;
// Razorpay accepts at most 256 characters in each note.
const NOTE_MAX = 250;

// Orders whose refund needs an admin: it failed, or it was interrupted and never finished.
const refundProblemFilter = () => ({
    $or: [
        { 'refund.status': 'failed' },
        { 'refund.status': 'pending', 'refund.requestedAt': { $lt: new Date(Date.now() - STUCK_REFUND_MS) } },
    ],
});

class OrderActionError extends Error {
    constructor(message, statusCode = 409) {
        super(message);
        this.statusCode = statusCode;
    }
}

const money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
const storefront = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');

// Emails every admin about a refund that didn't go through.
const alertAdmins = async (order, problem) => {
    const admins = await User.find({ role: 'admin' }).select('email').lean();
    const code = shortCode(order._id);
    const subject = `Refund failed for order ${code}`;
    const next = 'Retry it from the admin dashboard (Orders, “Refund problems”). If you refund it in the Razorpay dashboard instead, press Retry afterwards to record it.';
    const text = `The refund of ${money(order.refund?.amount)} for order ${code} did not go through: ${problem}\n\n${next}\n\n${storefront()}/admin`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656;font-size:22px">${escapeHtml(subject)}</h1><p>The refund of ${escapeHtml(money(order.refund?.amount))} did not go through: ${escapeHtml(problem)}</p><p>${escapeHtml(next)}</p><p><a href="${storefront()}/admin" style="color:#754656;font-weight:bold">Open the admin dashboard</a></p></div>`;
    await Promise.all(admins.map((admin) => sendEmail(admin.email, subject, text, html).catch(() => false)));
};

const recordRefund = (orderId, refundId) => Order.findByIdAndUpdate(orderId, {
    $set: { 'refund.status': 'refunded', 'refund.razorpayRefundId': refundId, 'refund.completedAt': new Date() },
    $unset: { 'refund.error': 1 },
}, { returnDocument: 'after' });

// Refunds the order's full amount through Razorpay and records the result. A failure is kept on
// the order so an admin can retry it; `alert` also emails the admins about it.
const issueRefund = async (order, { alert = false } = {}) => {
    let refund;
    try {
        refund = await getRazorpay().payments.refund(order.paymentId, {
            amount: Math.round(order.refund.amount * 100),
            speed: 'normal',
            notes: { order: String(order._id), reason: String(order.refund.reason || order.status).slice(0, NOTE_MAX) },
        });
    } catch (error) {
        const message = String(error?.error?.description || error.message || 'Razorpay did not accept the refund').slice(0, 300);
        console.error('ORDER REFUND FAILED - retry from the admin dashboard or refund in Razorpay. Order:', String(order._id), message);
        const failed = await Order.findByIdAndUpdate(order._id, { $set: { 'refund.status': 'failed', 'refund.error': message } }, { returnDocument: 'after' });
        // In the background: the customer's cancellation mustn't wait for, or fail with, this email.
        if (alert) alertAdmins(failed || order, message).catch((error) => console.error('Refund alert to admins failed:', error.message));
        return failed || order;
    }
    // The money is on its way. If recording that fails, the refund stays "pending"; a retry then
    // finds this refund at Razorpay instead of issuing another one.
    try {
        return (await recordRefund(order._id, refund.id)) || order;
    } catch (error) {
        console.error('Refund issued but not recorded. Order:', String(order._id), 'refund:', refund.id, error.message);
        return order;
    }
};

// A refund Razorpay already has for this order, if any: ours, issued just before a restart cut us
// off, or one an admin made by hand in the Razorpay dashboard that covers the amount.
const refundAtRazorpay = async (order) => {
    try {
        const { items = [] } = await getRazorpay().payments.fetchMultipleRefund(order.paymentId, { count: 100 });
        const made = items.filter((refund) => refund.status !== 'failed');
        const ours = made.find((refund) => refund.notes?.order === String(order._id));
        if (ours) return ours;
        const refundedPaise = made.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
        return refundedPaise >= Math.round(order.refund.amount * 100) ? made[0] : null;
    } catch {
        return null; // can't tell; a second refund attempt is refused by Razorpay anyway
    }
};

// A cancelled purchase no longer makes the customer a verified buyer of those products.
const refreshVerifiedBuyer = async (order) => {
    const reviews = await Review.find({ user: order.user, product: { $in: order.items.map((item) => item.productId) }, verifiedBuyer: true }).select('product').lean();
    for (const review of reviews) {
        const stillBought = await Order.exists({ user: order.user, 'items.productId': review.product, status: { $ne: 'cancelled' } });
        if (!stillBought) await Review.updateOne({ _id: review._id }, { $set: { verifiedBuyer: false } });
    }
};

// Tells the customer their order was cancelled or returned and what happens to their money. Never
// throws: by now the order is closed and refunded, so a failed email mustn't report a failure.
const sendClosedEmail = (order) => sendClosedEmailOrThrow(order).catch((error) => {
    console.error('Order closed email failed. Order:', String(order._id), error.message);
    return false;
});

const sendClosedEmailOrThrow = async (order) => {
    const customer = await User.findById(order.user).select('email name').lean();
    if (!customer?.email) return false;
    const code = shortCode(order._id);
    const what = order.status === 'cancelled' ? `Your order ${code} has been cancelled.` : `We have received the return of your order ${code}.`;
    const refund = !order.refund?.status
        ? ''
        : order.refund.status === 'refunded'
            ? `A refund of ${money(order.refund.amount)} has been issued to your original payment method. It usually reaches your account in 5 to 7 working days.`
            : `A refund of ${money(order.refund.amount)} is being arranged. We'll email you as soon as it's issued; you don't need to do anything.`;
    const text = `Hi ${customer.name || 'there'},\n\n${what} ${refund}\n\nYou can see the order on your My orders page: ${storefront()}/orders\n\nANM-Shop`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656;font-size:22px">${escapeHtml(what)}</h1>${refund ? `<p>${escapeHtml(refund)}</p>` : ''}<p><a href="${storefront()}/orders" style="color:#754656;font-weight:bold">View My orders</a></p></div>`;
    const subject = order.status === 'cancelled' ? `Order ${code} cancelled` : `Return received for order ${code}`;
    return sendEmail(customer.email, subject, text, html).catch(() => false);
};

// Cancels or returns an order: changes its status, optionally puts the items back in stock,
// gives back the coupon use (cancellations only) and refunds the full amount. The status change
// is claimed atomically, so a double click or two admins can never refund an order twice.
//   kind: 'cancel' | 'return'; userId limits it to that customer's own orders.
const closeOrder = async ({ orderId, kind, by, userId, reason = '', restock }) => {
    const existing = await Order.findOne({ _id: orderId, ...(userId ? { user: userId } : {}) }).lean();
    if (!existing) throw new OrderActionError('Order not found', 404);
    if (!CLOSABLE[kind].includes(existing.status)) {
        throw new OrderActionError(kind === 'cancel'
            ? (existing.status === 'cancelled' ? 'This order is already cancelled' : 'Only orders that haven’t shipped yet can be cancelled. For a shipped order, ask for a return on the Support page.')
            : 'Only shipped or delivered orders can be marked as returned');
    }

    const now = new Date();
    const putBack = kind === 'cancel' ? restock !== false : Boolean(restock);
    const update = {
        status: CLOSED_STATUS[kind],
        closedAt: now,
        closedBy: by,
        restocked: putBack,
        ...(existing.paymentId ? { refund: { status: 'pending', amount: existing.totalAmount, reason: reason.slice(0, 300), requestedAt: now } } : {}),
    };

    let order;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            order = await Order.findOneAndUpdate(
                { _id: existing._id, status: { $in: CLOSABLE[kind] } },
                { $set: update },
                { session, returnDocument: 'after' },
            );
            if (!order) throw new OrderActionError('This order was just changed by someone else. Refresh and try again.');
            if (putBack) {
                for (const item of order.items) {
                    await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } }, { session });
                }
            }
            if (kind === 'cancel' && order.couponCode) {
                // The checkout record names the exact coupon; the code alone may since belong to
                // another one (coupons can be renamed or re-created). Older orders fall back to it.
                const checkout = await PaymentIntent.findOne({ order: order._id }).select('coupon').session(session).lean();
                const which = checkout ? (checkout.coupon?.id ? { _id: checkout.coupon.id } : null) : { code: order.couponCode };
                const coupon = which && await Coupon.findOneAndUpdate(
                    { ...which, usedCount: { $gt: 0 } },
                    { $inc: { usedCount: -1 } },
                    { session },
                );
                if (coupon) {
                    await CouponUsage.updateOne({ coupon: coupon._id, user: order.user, count: { $gt: 0 } }, { $inc: { count: -1 } }, { session });
                }
            }
        });
    } finally {
        await session.endSession();
    }

    if (kind === 'cancel') await refreshVerifiedBuyer(order).catch((error) => console.error('Verified-buyer refresh failed:', error.message));
    if (order.refund?.status === 'pending') order = await issueRefund(order, { alert: true });
    await sendClosedEmail(order);
    return order;
};

// Tries a failed (or interrupted) refund again.
const retryRefund = async (orderId) => {
    const claimed = await Order.findOneAndUpdate(
        { _id: orderId, ...refundProblemFilter() },
        { $set: { 'refund.status': 'pending', 'refund.requestedAt': new Date() } },
        { returnDocument: 'after' },
    );
    if (!claimed) {
        const order = await Order.findById(orderId).select('refund').lean();
        if (!order) throw new OrderActionError('Order not found', 404);
        throw new OrderActionError(order.refund?.status === 'refunded' ? 'This order has already been refunded' : 'There is no failed refund to retry on this order');
    }
    // An interrupted refund may have gone through at Razorpay already.
    const issued = await refundAtRazorpay(claimed);
    const order = issued ? ((await recordRefund(claimed._id, issued.id)) || claimed) : await issueRefund(claimed);
    if (order.refund.status === 'refunded') await sendClosedEmail(order);
    return order;
};

module.exports = { closeOrder, retryRefund, refundProblemFilter, OrderActionError, CLOSABLE };
