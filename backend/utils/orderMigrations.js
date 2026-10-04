const Order = require('../model/Order');

// Orders paid with a free-shipping coupon used to be saved with shipping 0 and the waived ₹49
// also counted as a discount, so subtotal + shipping - discount came out ₹49 short of the total.
// Restores the shipping fee on those orders. Only touches orders whose breakdown doesn't add
// up, so it does nothing once they are fixed and is safe on every start.
const fixOrderBreakdowns = async () => {
    const result = await Order.collection.updateMany(
        {
            subtotalAmount: { $ne: null },
            $expr: {
                $gt: [
                    { $abs: { $subtract: [
                        { $subtract: [{ $add: ['$subtotalAmount', { $ifNull: ['$shippingFee', 0] }] }, { $ifNull: ['$discountAmount', 0] }] },
                        '$totalAmount',
                    ] } },
                    0.005,
                ],
            },
        },
        [{ $set: { shippingFee: { $round: [{ $add: [{ $subtract: ['$totalAmount', '$subtotalAmount'] }, { $ifNull: ['$discountAmount', 0] }] }, 2] } } }],
    );
    if (result.modifiedCount) console.log(`Fixed the price breakdown on ${result.modifiedCount} order(s)`);
};

module.exports = { fixOrderBreakdowns };
