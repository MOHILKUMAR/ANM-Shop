const mongoose = require('mongoose');
const userShema = new mongoose.Schema({
    name: {
       type : String,
       required : true,
    },
    email: {
        type: String,
        required : true,
        unique : true
    },
    password : {
        type : String,
        required : true
    },
    role : {
        type : String,
        enum : ['user', 'admin'],
        default : 'user'
        }
    ,
    verified : {
        type: Boolean,
        default: false
    },
    verificationOtpHash: { type: String, select: false },
    verificationOtpExpiresAt: { type: Date, select: false },
    verificationOtpSentAt: { type: Date, select: false },
    verificationOtpAttempts: { type: Number, default: 0, select: false },
});

module.exports = mongoose.model("User", userShema);
