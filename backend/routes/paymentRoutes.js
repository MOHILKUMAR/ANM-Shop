const express = require("express");
const {createdOrder, verifyPayment} = require('../controller/paymentController.js');
const { protect } = require('../middleware/authMiddleware.js');
const { paymentLimiter } = require('../middleware/rateLimiters.js');
const router = express.Router();

router.post("/order", protect, paymentLimiter, createdOrder);
router.post("/verify", protect, paymentLimiter, verifyPayment);

module.exports = router;