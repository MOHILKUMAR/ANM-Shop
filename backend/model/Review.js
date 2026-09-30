const mongoose = require('mongoose');

// The three choices customers pick from, worst to best.
const RATINGS = ['bad', 'good', 'excellent'];

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Shown publicly as "Priya S."; the full name stays in the user record.
    name: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: String, enum: RATINGS, required: true },
    // Empty only for reviews carried over from the old star ratings, which had no text.
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    // The reviewer has a paid order containing this product.
    verifiedBuyer: { type: Boolean, default: false },
    // Hidden by an admin: kept, but left out of the product page and its rating.
    hidden: { type: Boolean, default: false },
    hiddenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One review per customer per product; submitting again edits it.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, hidden: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
module.exports.RATINGS = RATINGS;
