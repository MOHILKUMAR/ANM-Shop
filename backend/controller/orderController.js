const mongoose = require('mongoose');
const Order = require('../model/Order');
const sendOrderInvoice = require('../utils/sendOrderInvoice');
const { closeOrder, retryRefund, OrderActionError } = require('../utils/orderRefunds');

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
// status, with how many orders have each status.
const ADMIN_PAGE_SIZE = 20;
const getOrders = async (req, res) => {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || ADMIN_PAGE_SIZE, 1), 100);
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const statuses = Order.schema.path('status').enumValues;
    if (page < 1 || (status && !statuses.includes(status))) {
        return res.status(400).json({ message: 'Invalid page or order status' });
    }
    try {
        const filter = status ? { status } : {};
        const [orders, total, counts] = await Promise.all([
            Order.find(filter)
                .populate('user', 'name email')
                .populate('items.productId', 'name price imageUrls')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Order.countDocuments(filter),
            Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);
        const byStatus = Object.fromEntries(statuses.map((value) => [value, 0]));
        counts.forEach(({ _id, count }) => { if (_id in byStatus) byStatus[_id] = count; });
        return res.json({ orders, counts: byStatus, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
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

const updateOrderstatus = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }
    try {
        const { status } = req.body;
        if (!['pending', 'shipped', 'delivered'].includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        // Cancelled and returned orders have been refunded; they can't be reopened.
        if (['cancelled', 'returned'].includes(order.status)) {
            return res.status(409).json({ message: `This order was ${order.status} and refunded; its status can't change` });
        }
        order.status = status;
        await order.save();
        return res.json({ message: 'Order status updated', order });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to update order status' });
    }
};

// Removes the order record only: the customer is not refunded and stock is not restored.
// The checkout payment record stays, so the payment can still be traced.
const deleteOrder = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
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
    return ' The refund could not be completed automatically; the team has been notified and will refund you.';
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
            : res.status(502).json({ message: `The refund failed again: ${order.refund.error || 'Razorpay refused it'}. Refund it in the Razorpay dashboard.`, order });
    } catch (error) {
        return respondToAction(res, error, 'Unable to retry the refund');
    }
};

module.exports = { myOrders, getOrders, resendOrderInvoice, updateOrderstatus, deleteOrder, cancelOrder, returnOrder, retryOrderRefund };