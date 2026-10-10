const mongoose = require('mongoose');

// A shop category. Products store the category's name, so renaming one also renames it on its
// products and coupons (controller/categoryController.js).
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    // A short symbol shown on the home page tile, e.g. "✦".
    icon: { type: String, trim: true, maxlength: 8, default: '✦' },
    sortOrder: { type: Number, min: 0, max: 999, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Category', categorySchema);
