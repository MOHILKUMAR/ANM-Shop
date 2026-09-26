const User = require('../model/User');
const Order = require('../model/Order');
const Product = require('../model/Product');

const PAID_ORDER_FILTER = { paymentId: { $exists: true, $ne: null } };
const moneyTotals = async (from, to) => {
    const [result] = await Order.aggregate([
        { $match: { ...PAID_ORDER_FILTER, createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]);
    return result || { revenue: 0, orders: 0 };
};

const getAdminStats = async (req, res) => {
    try {
        const now = new Date();
        const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const salesStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
        const monthsStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

        const [totalUser, totalOrder, totalProduct, allTime, thisMonth, lastMonth, dailySales, monthlySales, statuses, topProducts, lowStockCount] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            Order.countDocuments({}),
            Product.countDocuments({}),
            Order.aggregate([
                { $match: PAID_ORDER_FILTER },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
            ]),
            moneyTotals(currentMonthStart, nextMonthStart),
            moneyTotals(previousMonthStart, currentMonthStart),
            Order.aggregate([
                { $match: { ...PAID_ORDER_FILTER, createdAt: { $gte: salesStart, $lt: nextMonthStart } } },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                } },
                { $sort: { _id: 1 } },
            ]),
            Order.aggregate([
                { $match: { ...PAID_ORDER_FILTER, createdAt: { $gte: monthsStart, $lt: nextMonthStart } } },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                } },
                { $sort: { _id: 1 } },
            ]),
            Order.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: PAID_ORDER_FILTER },
                { $unwind: '$items' },
                { $group: {
                    _id: '$items.productId',
                    unitsSold: { $sum: '$items.qty' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
                } },
                { $sort: { unitsSold: -1, revenue: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
                { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
                { $project: {
                    _id: 0,
                    productId: '$_id',
                    name: { $ifNull: ['$product.name', 'Deleted product'] },
                    unitsSold: 1,
                    revenue: 1,
                } },
            ]),
            Product.countDocuments({ stock: { $lte: 5 } }),
        ]);

        const dailyMap = new Map(dailySales.map((day) => [day._id, day]));
        const salesLast7Days = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(salesStart);
            date.setUTCDate(date.getUTCDate() + index);
            const key = date.toISOString().slice(0, 10);
            const day = dailyMap.get(key);
            return { date: key, revenue: day?.revenue || 0, orders: day?.orders || 0 };
        });

        const monthMap = new Map(monthlySales.map((month) => [month._id, month]));
        const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
            const date = new Date(monthsStart);
            date.setUTCMonth(date.getUTCMonth() + index);
            const key = date.toISOString().slice(0, 7);
            const month = monthMap.get(key);
            return { month: key, revenue: month?.revenue || 0, orders: month?.orders || 0 };
        });

        const orderStatus = { pending: 0, shipped: 0, delivered: 0 };
        statuses.forEach(({ _id, count }) => {
            if (Object.hasOwn(orderStatus, _id)) orderStatus[_id] = count;
        });

        const [overall] = allTime;
        return res.json({
            totalUser,
            totalOrder,
            totalProduct,
            totalRevenue: overall?.revenue || 0,
            paidOrderCount: overall?.orders || 0,
            averageOrderValue: overall?.orders ? overall.revenue / overall.orders : 0,
            revenueThisMonth: thisMonth.revenue,
            revenueLastMonth: lastMonth.revenue,
            ordersThisMonth: thisMonth.orders,
            salesLast7Days,
            revenueByMonth,
            orderStatus,
            topProducts,
            lowStockCount,
        });
    } catch (error) {
        console.error('Admin analytics error:', error.message);
        return res.status(500).json({ message: 'Unable to fetch admin analytics' });
    }
};

module.exports = { getAdminStats };
