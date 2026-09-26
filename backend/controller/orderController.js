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

const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'name email')
            .populate('items.productId', 'name price imageUrls')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders' });
    }
};

const resendOrderInvoice = async (req, res) => {
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