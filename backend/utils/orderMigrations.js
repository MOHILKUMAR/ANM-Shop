const mongoose = require('mongoose');
const Order = require('../model/Order');

// Records which one-time fixes have run, so they don't scan the database on every start.
const migrations = () => mongoose.connection.db.collection('migrations');
const MIGRATION_ID = 'order-shipping-breakdown-2026-10';

// Orders paid with a free-shipping coupon used to be saved with shipping 0 while the discount
// also counted the waived ₹49, so subtotal + shipping - discount came out ₹49 short of the total.
// Restores the shipping fee on those orders. New orders take it from the totals
// (fulfillPayment), so this only has to run once; the marker skips it afterwards.
const fixOrderBreakdowns = async () => {
    if (await migrations().findOne({ _id: MIGRATION_ID })) return;

    const result = await Order.collection.updateMany(
        {
            subtotalAmount: { $ne: null },
            shippingFee: 0,
            couponCode: { $ne: null },
            $expr: {
                $gt: [
                    { $abs: { $subtract: [{ $subtract: [{ $add: ['$subtotalAmount', '$shippingFee'] }, { $ifNull: ['$discountAmount', 0] }] }, '$totalAmount'] } },
                    0.005,
                ],
            },
        },
        [{ $set: { shippingFee: { $round: [{ $add: [{ $subtract: ['$totalAmount', '$subtotalAmount'] }, { $ifNull: ['$discountAmount', 0] }] }, 2] } } }],
    );

    // An upsert, so two servers starting at once both finish without a duplicate-key error.
    await migrations().updateOne({ _id: MIGRATION_ID }, { $setOnInsert: { ranAt: new Date() } }, { upsert: true });
    if (result.modifiedCount) console.log(`Fixed the price breakdown on ${result.modifiedCount} order(s)`);
};

module.exports = { fixOrderBreakdowns };
