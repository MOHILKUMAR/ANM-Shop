const Razorpay = require('razorpay');

// A Razorpay API client for the keys in the environment (shared by checkout and order refunds).
const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = { getRazorpay };
