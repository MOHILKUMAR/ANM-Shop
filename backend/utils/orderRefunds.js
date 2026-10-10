const mongoose = require('mongoose');
const Order = require('../model/Order');
const Product = require('../model/Product');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
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

class OrderActionError extends Error {
    constructor(message, statusCode = 409) {
        super(message);
        this.statusCode = statusCode;
    }
}

const money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
const storefront = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');

// Refunds the order's full amount through Razorpay and records the result. A failure is kept on
// the order so an admin can retry it.
const issueRefund = async (order) => {
    try {
        const refund = await getRazorpay().payments.refund(order.paymentId, {
            amount: Math.round(order.refund.amount * 100),
            speed: 'normal',
            notes: { order: String(order._id), reason: order.refund.reason || order.status },
        });
        return Order.findByIdAndUpdate(order._id, {
            $set: { 'refund.status': 'refunded', 'refund.razorpayRefundId': refund.id, 'refund.completedAt': new Date() },
            $unset: { 'refund.error': 1 },
        }, { returnDocument: 'after' });
    } catch (error) {
        const message = String(error?.error?.description || error.message || 'Razorpay did not accept the refund').slice(0, 300);
        console.error('ORDER REFUND FAILED - retry from the admin dashboard or refund in Razorpay. Order:', String(order._id), message);
        return Order.findByIdAndUpdate(order._id, { $set: { 'refund.status': 'failed', 'refund.error': message } }, { returnDocument: 'after' });
    }
};

// Tells the customer their order was cancelled or returned and what happens to their money.
const sendClosedEmail = async (order) => {
    const customer = await User.findById(order.user).select('email name').lean();
    if (!customer?.email) return false;
    const code = shortCode(order._id);
    const what = order.status === 'cancelled' ? `Your order ${code} has been cancelled.` : `We have received the return of your order ${code}.`;
    const refund = !order.refund?.status
        ? ''
        : order.refund.status === 'refunded'
            ? `A refund of ${money(order.refund.amount)} has been issued to your original payment method. It usually reaches your account in 5 to 7 working days.`
            : `A refund of ${money(order.refund.amount)} is being arranged and our team has been notified. You don't need to do anything.`;
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
                const coupon = await Coupon.findOneAndUpdate(
                    { code: order.couponCode, usedCount: { $gt: 0 } },
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

    if (order.refund?.status === 'pending') order = await issueRefund(order);
    await sendClosedEmail(order);
    return order;
};

// Tries a failed (or interrupted) refund again.
const retryRefund = async (orderId) => {
    const claimed = await Order.findOneAndUpdate(
        {
            _id: orderId,
            $or: [
                { 'refund.status': 'failed' },
                { 'refund.status': 'pending', 'refund.requestedAt': { $lt: new Date(Date.now() - STUCK_REFUND_MS) } },
            ],
        },
        { $set: { 'refund.status': 'pending', 'refund.requestedAt': new Date() } },
        { returnDocument: 'after' },
    );
    if (!claimed) {
        const order = await Order.findById(orderId).select('refund').lean();
        if (!order) throw new OrderActionError('Order not found', 404);
        throw new OrderActionError(order.refund?.status === 'refunded' ? 'This order has already been refunded' : 'There is no failed refund to retry on this order');
    }
    const order = await issueRefund(claimed);
    if (order.refund.status === 'refunded') await sendClosedEmail(order);
    return order;
};

module.exports = { closeOrder, retryRefund, OrderActionError, CLOSABLE };
