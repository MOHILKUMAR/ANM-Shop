const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: Number.isInteger,
    },
    sentiment: {
        type: String,
        required: true,
        enum: ['good', 'average', 'bad'],
    },
}, { timestamps: true });

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
    rating: {type: Number, default:0},
    numReviews : {type: Number, default : 0},
    reviews: [reviewSchema],

});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
