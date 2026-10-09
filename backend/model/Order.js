const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
    
        user : {type: mongoose.Schema.Types.ObjectId, ref: 'User', required:true},
        items : [
            {
                productId : { type : mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
                qty : { type: Number, required: true, min : 1},
                price : { type:Number, required: true },
            }
        ],
        totalAmount : {type: Number, required: true},
        // Breakdown of totalAmount (the amount paid): items + shipping - discount. Older orders
        // only have totalAmount.
        subtotalAmount : { type: Number },
        shippingFee : { type: Number, default: 0 },
        discountAmount : { type: Number, default: 0 },
        couponCode : { type: String },
        paymentMethod : { type: String },
        address : {
            fullName: {type: String , required : true},
            street : { type: String , required : true},
            city :  {type: String , required: true},
            postalCode : { type: String, required : true},
            country: { type: String, required : true}, 
            phone: { type: String, maxlength: 20 },

        },
        paymentId : { type: String, unique: true, sparse: true },
        invoiceEmailSent : { type: Boolean, default: false },
        // pending -> shipped -> delivered. A pending order can be cancelled (by the customer or an
        // admin); a shipped or delivered one can be returned (admin). Both refund the full amount.
        status : {type: String, enum : ['pending', 'shipped', 'delivered', 'cancelled', 'returned'], default:'pending'},
        closedAt : { type: Date },
        closedBy : { type: String, enum: ['customer', 'admin'] },
        // Whether the items went back into stock when the order was cancelled or returned.
        restocked : { type: Boolean },
        // The refund for a cancelled or returned order (utils/orderRefunds.js).
        refund : {
            status: { type: String, enum: ['pending', 'refunded', 'failed'] },
            amount: { type: Number },
            reason: { type: String, maxlength: 300 },
            razorpayRefundId: { type: String },
            error: { type: String, maxlength: 300 },
            requestedAt: { type: Date },
            completedAt: { type: Date },
        },


        
    },
    { timestamps : true,})

    module.exports = mongoose.model('Order' , orderSchema);