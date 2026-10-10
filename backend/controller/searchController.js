const mongoose = require('mongoose');
const Order = require('../model/Order');
const PaymentIntent = require('../model/PaymentIntent');
const User = require('../model/User');

const RESULT_LIMIT = 20;
const CUSTOMER_LIMIT = 10;
const HISTORY_LIMIT = 25;
const USER_FIELDS = 'name email role verified';
const SEARCH_HINT = 'Search by order ID (full or the 8-character #code), Razorpay payment ID (pay_...), Razorpay order ID (order_...), or customer email';

// Orders are shown as "#" + the last 8 characters of their id, so admins can paste that code.
const idEndsWith = (suffix) => ({
    $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${suffix}$`, options: 'i' } },
});

const buildFilters = (query) => {
    const orders = [];
    const payments = [];
    const users = [];

    if (/^[0-9a-f]{24}$/i.test(query)) {
        // A full id could belong to an order, a checkout payment, or a customer.
        orders.push({ _id: query });
        payments.push({ _id: query }, { order: query });
        users.push({ _id: query });
    } else if (/^[0-9a-f]{6,23}$/i.test(query)) {
        orders.push(idEndsWith(query.toLowerCase()));
    }
    if (/^pay_[A-Za-z0-9]+$/.test(query)) {
        orders.push({ paymentId: query });
        payments.push({ paymentId: query });
    }
    if (/^order_[A-Za-z0-9]+$/.test(query)) {
        payments.push({ razorpayOrderId: query });
    }
    if (/^\S+@\S+\.\S+$/.test(query)) {
        users.push({ email: query.toLowerCase() });
    }
    return { orders, payments, users };
};

const findIds = async (Model, filters, fields = '_id') => (
    filters.length ? Model.find({ $or: filters }).select(fields).limit(RESULT_LIMIT).lean() : []
);

const customerHistory = async (userId) => {
    const [user, orders, payments, [totals]] = await Promise.all([
        User.findById(userId).select(USER_FIELDS).lean(),
        Order.find({ user: userId })
            .select('totalAmount status paymentId createdAt')
            .sort({ createdAt: -1 })
            .limit(HISTORY_LIMIT)
            .lean(),
        PaymentIntent.find({ user: userId })
            .select('razorpayOrderId paymentId status amountPaise order refundId createdAt')
            .sort({ createdAt: -1 })
            .limit(HISTORY_LIMIT)
            .lean(),
        Order.aggregate([
            { $match: { user: userId } },
            // Cancelled and returned orders were refunded (as on the Users tab).
            { $group: { _id: null, orderCount: { $sum: 1 }, totalSpent: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 0, '$totalAmount'] } } } },
        ]),
    ]);
    return {
        user: user || { _id: userId, name: 'Deleted account', email: '' },
        orderCount: totals?.orderCount || 0,
        totalSpent: totals?.totalSpent || 0,
        orders,
        payments,
    };
};

const searchRecords = async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^#/, '') : '';
    if (!query || query.length > 100) {
        return res.status(400).json({ message: SEARCH_HINT });
    }

    const filters = buildFilters(query);
    if (!filters.orders.length && !filters.payments.length && !filters.users.length) {
        return res.status(400).json({ message: SEARCH_HINT });
    }

    try {
        const [orderHits, paymentHits, userHits] = await Promise.all([
            findIds(Order, filters.orders, '_id user'),
            findIds(PaymentIntent, filters.payments, '_id order user'),
            findIds(User, filters.users),
        ]);

        // Link each order to the checkout payment that created it (and back), so searching
        // either identifier shows both records.
        const orderIds = new Set(orderHits.map((order) => String(order._id)));
        paymentHits.forEach((payment) => payment.order && orderIds.add(String(payment.order)));
        const paymentIds = new Set(paymentHits.map((payment) => String(payment._id)));

        const [orders, linkedPayments] = await Promise.all([
            Order.find({ _id: { $in: [...orderIds] } })
                .populate('user', 'name email')
                .populate('items.productId', 'name')
                .sort({ createdAt: -1 })
                .lean(),
            PaymentIntent.find({ order: { $in: [...orderIds] }, _id: { $nin: [...paymentIds] } })
                .select('_id')
                .lean(),
        ]);
        linkedPayments.forEach((payment) => paymentIds.add(String(payment._id)));

        const payments = await PaymentIntent.find({ _id: { $in: [...paymentIds] } })
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        const customerIds = [...new Set([
            ...userHits.map((user) => user._id),
            ...orders.map((order) => order.user?._id || order.user),
            ...payments.map((payment) => payment.user?._id || payment.user),
        ].filter(Boolean).map(String))].slice(0, CUSTOMER_LIMIT);
        const customers = await Promise.all(
            customerIds.map((id) => customerHistory(new mongoose.Types.ObjectId(id))),
        );

        return res.json({ query, orders, payments, customers });
    } catch (error) {
        console.error('Admin search error:', error.message);
        return res.status(500).json({ message: 'Unable to search records' });
    }
};

module.exports = { searchRecords };
