const mongoose = require('mongoose');

const paymentIntentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        qty: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    address: {
      fullName: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, maxlength: 20 },
    },
    razorpayOrderId: { type: String, required: true, unique: true },
    amountPaise: { type: Number, required: true, min: 1 },
    paymentId: { type: String },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'refund_pending', 'refunded', 'refund_failed'],
      default: 'pending',
    },
    refundId: { type: String },
    failureReason: { type: String, maxlength: 200 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
