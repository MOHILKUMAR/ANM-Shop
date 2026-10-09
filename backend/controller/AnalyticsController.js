const User = require('../model/User');
const Order = require('../model/Order');
const Product = require('../model/Product');

// Paid orders that still count as sales: cancelled and returned orders were refunded.
const PAID_ORDER_FILTER = { paymentId: { $exists: true, $ne: null }, status: { $nin: ['cancelled', 'returned'] } };
// Days and months are counted in India time, where the store sells: an order at 1 Oct 01:30 IST
// belongs to October even though it is still 30 Sep in UTC. India has no daylight saving.
const STORE_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
// The moment a calendar date in India starts (Date.UTC normalises overflowing days and months).
const istStart = (year, month, day = 1) => new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);
const moneyTotals = async (from, to) => {
    const [result] = await Order.aggregate([
        { $match: { ...PAID_ORDER_FILTER, createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]);
    return result || { revenue: 0, orders: 0 };
};

const getAdminStats = async (req, res) => {
    try {
        // Today's date in India, read from a clock shifted to IST.
        const india = new Date(Date.now() + IST_OFFSET_MS);
        const [year, month, date] = [india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()];
        const currentMonthStart = istStart(year, month);
        const nextMonthStart = istStart(year, month + 1);
        const previousMonthStart = istStart(year, month - 1);
        const salesStart = istStart(year, month, date - 6);
        const monthsStart = istStart(year, month - 5);

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
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STORE_TIME_ZONE } },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                } },
                { $sort: { _id: 1 } },
            ]),
            Order.aggregate([
                { $match: { ...PAID_ORDER_FILTER, createdAt: { $gte: monthsStart, $lt: nextMonthStart } } },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: STORE_TIME_ZONE } },
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
        // Keys are India calendar dates ("2026-10-04") and months ("2026-10").
        const salesLast7Days = Array.from({ length: 7 }, (_, index) => {
            const key = new Date(Date.UTC(year, month, date - 6 + index)).toISOString().slice(0, 10);
            const day = dailyMap.get(key);
            return { date: key, revenue: day?.revenue || 0, orders: day?.orders || 0 };
        });

        const monthMap = new Map(monthlySales.map((entry) => [entry._id, entry]));
        const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
            const key = new Date(Date.UTC(year, month - 5 + index, 1)).toISOString().slice(0, 7);
            const totals = monthMap.get(key);
            return { month: key, revenue: totals?.revenue || 0, orders: totals?.orders || 0 };
        });

        const orderStatus = { pending: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0 };
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
