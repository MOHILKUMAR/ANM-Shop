const mongoose = require('mongoose');

// How many paid orders a customer has placed with a coupon. One document per pair lets the
// per-user limit be enforced with a single conditional update when an order is created.
const couponUsageSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    count: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

couponUsageSchema.index({ coupon: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
