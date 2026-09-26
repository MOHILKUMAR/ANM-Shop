const express = require("express");
const {createdOrder, verifyPayment, deletePaymentRecord} = require('../controller/paymentController.js');
const { protect } = require('../middleware/authMiddleware.js');
const { admin } = require('../middleware/adminMiddleware.js');
const { paymentLimiter } = require('../middleware/rateLimiters.js');
const router = express.Router();

router.post("/order", protect, paymentLimiter, createdOrder);
router.post("/verify", protect, paymentLimiter, verifyPayment);
router.delete("/records/:id", protect, admin, deletePaymentRecord);

module.exports = router;