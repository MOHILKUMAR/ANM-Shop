const mongoose = require('mongoose');
const Order = require('../model/Order');
const sendOrderInvoice = require('../utils/sendOrderInvoice');
const { closeOrder, retryRefund, refundProblemFilter, OrderActionError } = require('../utils/orderRefunds');

const myOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate('items.productId', 'name price imageUrls')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders' });
    }
};

// GET /api/orders — every order for admins, newest first, a page at a time, optionally only one
// status (or `refund=problem`: refunds that failed or never finished), with how many orders
// have each status and how many refunds need attention.
const ADMIN_PAGE_SIZE = 20;
const getOrders = async (req, res) => {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || ADMIN_PAGE_SIZE, 1), 100);
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const refundProblems = req.query.refund === 'problem';
    const statuses = Order.schema.path('status').enumValues;
    if (page < 1 || (status && !statuses.includes(status))) {
        return res.status(400).json({ message: 'Invalid page or order status' });
    }
    try {
        const filter = { ...(status ? { status } : {}), ...(refundProblems ? refundProblemFilter() : {}) };
        const [orders, total, counts, problemCount] = await Promise.all([
            Order.find(filter)
                .populate('user', 'name email')
                .populate('items.productId', 'name price imageUrls')
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Order.countDocuments(filter),
            Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Order.countDocuments(refundProblemFilter()),
        ]);
        const byStatus = Object.fromEntries(statuses.map((value) => [value, 0]));
        counts.forEach(({ _id, count }) => { if (_id in byStatus) byStatus[_id] = count; });
        return res.json({ orders, counts: byStatus, refundProblems: problemCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        console.error('List orders error:', error.message);
        return res.status(500).json({ message: 'Error fetching orders' });
    }
};

const resendOrderInvoice = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
            .populate('items.productId', 'name price');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!order.paymentId) {
            return res.status(400).json({ message: 'A paid order is required to send an e-bill' });
        }
        // The e-bill presents the order as paid; a cancelled or returned one was refunded.
        if (['cancelled', 'returned'].includes(order.status)) {
            return res.status(409).json({ message: `This order was ${order.status} and refunded, so there is no e-bill to send` });
        }

        const sent = await sendOrderInvoice(order, req.user.email);
        if (!sent) {
            return res.status(502).json({ message: 'The e-bill could not be sent. Check the email service configuration and try again.' });
        }

        order.invoiceEmailSent = true;
        await order.save();
        return res.json({ message: 'E-bill sent successfully', invoiceEmailSent: true });
    } catch (error) {
        console.error('Resend order e-bill error:', error.message);
        return res.status(500).json({ message: 'Unable to send the e-bill' });
    }
};

const SHIPPING_STATUSES = ['pending', 'shipped', 'delivered'];

const updateOrderstatus = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }
    try {
        const { status } = req.body;
        if (!SHIPPING_STATUSES.includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        // Cancelled and returned orders have been refunded; they can't be reopened. Checked in
        // the same step as the change, so a cancellation at the same moment can't be overwritten.
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, status: { $in: SHIPPING_STATUSES } },
            { $set: { status } },
            { returnDocument: 'after' },
        );
        if (!order) {
            const existing = await Order.findById(req.params.id).select('status').lean();
            if (!existing) return res.status(404).json({ message: 'Order not found' });
            return res.status(409).json({ message: `This order was ${existing.status} and refunded; its status can't change` });
        }
        return res.json({ message: 'Order status updated', order });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to update order status' });
    }
};

// Removes the order record only: the customer is not refunded and stock is not restored.
// The checkout payment record stays, so the payment can still be traced. An order whose refund
// hasn't gone through is kept: it is the record that the customer is owed money.
const deleteOrder = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }
    try {
        const order = await Order.findOneAndDelete({ _id: req.params.id, 'refund.status': { $nin: ['pending', 'failed'] } });
        if (!order) {
            if (!(await Order.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'Order not found' });
            return res.status(409).json({ message: 'This order’s refund hasn’t gone through yet. Retry it (or refund it in Razorpay) before deleting the order.' });
        }
        return res.json({ message: 'Order deleted' });
    } catch (error) {
        console.error('Delete order error:', error.message);
        return res.status(500).json({ message: 'Unable to delete order' });
    }
};

const respondToAction = (res, error, fallback) => {
    if (error instanceof OrderActionError) return res.status(error.statusCode).json({ message: error.message });
    console.error(`${fallback}:`, error.message);
    return res.status(500).json({ message: fallback });
};

const refundNote = (order) => {
    if (!order.refund?.status) return '';
    if (order.refund.status === 'refunded') return ` A refund of ₹${order.refund.amount} has been issued; it usually arrives in 5 to 7 working days.`;
    return ' The refund couldn’t be completed automatically yet. We’ve been alerted and will email you as soon as it’s issued.';
};

// POST /api/orders/:id/cancel — a customer cancels their own order before it ships; an admin
// can cancel any order that hasn't shipped. The full amount is refunded and stock restored.
const cancelOrder = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID' });
    const isAdmin = req.user.role === 'admin';
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length > 300) return res.status(400).json({ message: 'Keep the reason under 300 characters' });
    try {
        const order = await closeOrder({
            orderId: req.params.id,
            kind: 'cancel',
            by: isAdmin ? 'admin' : 'customer',
            // Admins may cancel anyone's order; customers only their own.
            userId: isAdmin ? undefined : req.user._id,
            reason,
        });
        return res.json({ message: `Order cancelled.${refundNote(order)}`, order });
    } catch (error) {
        return respondToAction(res, error, 'Unable to cancel the order');
    }
};

// POST /api/orders/:id/return (admin) — the customer sent a shipped or delivered order back.
// Refunds the full amount; `restock` puts the items back on sale (leave it off for opened items).
const returnOrder = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID' });
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length > 300) return res.status(400).json({ message: 'Keep the reason under 300 characters' });
    try {
        const order = await closeOrder({ orderId: req.params.id, kind: 'return', by: 'admin', reason, restock: req.body.restock === true });
        return res.json({ message: `Order marked as returned.${refundNote(order)}`, order });
    } catch (error) {
        return respondToAction(res, error, 'Unable to mark the order as returned');
    }
};

// POST /api/orders/:id/refund (admin) — retries a refund that failed.
const retryOrderRefund = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID' });
    try {
        const order = await retryRefund(req.params.id);
        return order.refund.status === 'refunded'
            ? res.json({ message: `Refund of ₹${order.refund.amount} issued.`, order })
            : res.status(502).json({ message: `The refund failed again: ${order.refund.error || 'Razorpay refused it'}. Refund it in the Razorpay dashboard, then press Retry to record it.`, order });
    } catch (error) {
        return respondToAction(res, error, 'Unable to retry the refund');
    }
};

module.exports = { myOrders, getOrders, resendOrderInvoice, updateOrderstatus, deleteOrder, cancelOrder, returnOrder, retryOrderRefund };