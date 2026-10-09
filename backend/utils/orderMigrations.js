const mongoose = require('mongoose');
const Order = require('../model/Order');
const PaymentIntent = require('../model/PaymentIntent');

// Records which one-time fixes have run, so they don't scan the database on every start.
const migrations = () => mongoose.connection.db.collection('migrations');
const MIGRATION_ID = 'order-shipping-breakdown-2026-10';

// subtotal + shipping - discount differs from the total (by more than rounding).
const breakdownIsOff = (subtotal, shipping, discount, total, tolerance) => ({
    $gt: [{ $abs: { $subtract: [{ $subtract: [{ $add: [subtotal, shipping] }, discount] }, total] } }, tolerance],
});

// Checkouts with a free-shipping coupon used to save shipping as 0 while the discount also
// counted the waived ₹49, so subtotal + shipping - discount came out ₹49 short of the total.
// This restores the shipping fee on those orders, and on unpaid checkouts started before the
// fix so they create correct orders when paid. Runs once; the marker skips it afterwards.
const fixOrderBreakdowns = async () => {
    if (await migrations().findOne({ _id: MIGRATION_ID })) return;

    const intents = await PaymentIntent.collection.updateMany(
        {
            subtotalPaise: { $ne: null },
            shippingPaise: 0,
            'coupon.code': { $ne: null },
            $expr: breakdownIsOff('$subtotalPaise', '$shippingPaise', { $ifNull: ['$discountPaise', 0] }, '$amountPaise', 0),
        },
        [{ $set: { shippingPaise: { $add: [{ $subtract: ['$amountPaise', '$subtotalPaise'] }, { $ifNull: ['$discountPaise', 0] }] } } }],
    );
    const orders = await Order.collection.updateMany(
        {
            subtotalAmount: { $ne: null },
            shippingFee: 0,
            couponCode: { $ne: null },
            $expr: breakdownIsOff('$subtotalAmount', '$shippingFee', { $ifNull: ['$discountAmount', 0] }, '$totalAmount', 0.005),
        },
        [{ $set: { shippingFee: { $round: [{ $add: [{ $subtract: ['$totalAmount', '$subtotalAmount'] }, { $ifNull: ['$discountAmount', 0] }] }, 2] } } }],
    );

    await migrations().insertOne({ _id: MIGRATION_ID, ranAt: new Date() });
    if (intents.modifiedCount || orders.modifiedCount) {
        console.log(`Fixed the price breakdown on ${orders.modifiedCount} order(s) and ${intents.modifiedCount} unpaid checkout(s)`);
    }
};

module.exports = { fixOrderBreakdowns };
