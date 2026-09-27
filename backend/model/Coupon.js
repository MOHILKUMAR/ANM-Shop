const mongoose = require('mongoose');

const DISCOUNT_TYPES = ['percentage', 'fixed', 'free_shipping', 'buy_x_get_y'];
const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'wallet'];

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    // Shown to customers in "My coupons" and at checkout.
    description: { type: String, trim: true, maxlength: 200, default: '' },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    // Percent (1-100) for percentage coupons, rupees for fixed coupons; unused otherwise.
    discountValue: { type: Number, min: 0, default: 0 },
    // Buy X Get Y: for every buyQuantity + getQuantity qualifying items, the getQuantity cheapest are free.
    buyQuantity: { type: Number, min: 1 },
    getQuantity: { type: Number, min: 1 },
    minCartValue: { type: Number, min: 0, default: 0 },
    maxDiscount: { type: Number, min: 0, default: null },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, min: 1, default: null },
    perUserLimit: { type: Number, min: 1, default: null },
    usedCount: { type: Number, min: 0, default: 0 },
    // Empty lists mean "no restriction".
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    applicableCategories: [{ type: String }],
    applicableUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    paymentMethods: [{ type: String, enum: PAYMENT_METHODS }],
    isActive: { type: Boolean, default: true },
    // Listed in customers' "My coupons"; hidden coupons still work when the code is typed.
    showToCustomers: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Coupon', couponSchema);
module.exports.DISCOUNT_TYPES = DISCOUNT_TYPES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
