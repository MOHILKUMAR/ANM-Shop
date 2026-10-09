const mongoose = require('mongoose');
const Order = require('../model/Order');
const sendOrderInvoice = require('../utils/sendOrderInvoice');
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
        if (order) {
            order.status = status;
            await order.save();
            return res.json({ message: 'Order status updated', order });
        }
        return res.status(404).json({ message: 'Order not found' });
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

module.exports = { myOrders, getOrders, resendOrderInvoice, updateOrderstatus, deleteOrder };