const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description : {
        type : String,
        required : true,
        trim: true,
        maxlength: 5000,
    },
    price : {
        type : Number,
        required : true,
        min: 0.01,
        max: 100000000,
    },
    category : {
        type : String,
        required : true,
        trim: true,
        maxlength: 80,
    },
    stock : {
        type : Number,
        required: true,
        min: 0,
        max: 1000000,
        validate: Number.isInteger,
    },
    // The main photo (the first of `images`). Carts, bills and emails use this one.
    imageUrls :{
        type : String,
        required : true,
        maxlength: 2048,
    },
    // Every photo in display order, up to 6. Products added before galleries existed only
    // have imageUrls.
    images: {
        type: [{ type: String, maxlength: 2048 }],
        default: undefined,
        validate: { validator: (list) => list.length <= 6, message: 'A product can have at most 6 photos' },
    },
    createdAt : {type: Date, default: Date.now},
    // Counts of visible reviews (model/Review.js), kept up to date by utils/reviews.js.
    numReviews : {type: Number, default : 0},
    ratingCounts: {
        bad: { type: Number, default: 0 },
        good: { type: Number, default: 0 },
        excellent: { type: Number, default: 0 },
    },

});

// Full-word search ranked by relevance; a match in the name counts more than in the description.
productSchema.index({ name: 'text', description: 'text' }, { name: 'product_text', weights: { name: 5, description: 1 } });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
