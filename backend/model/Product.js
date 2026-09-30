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
    imageUrls :{
        type : String,
        required : true,
        maxlength: 2048,
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

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
