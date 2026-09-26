const express = require('express');
const router = express.Router();
const { registerUser, verifyEmail, resendVerificationOtp, loginUser, changePassword, getUsers} = require("../controller/authController");
const {protect  } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiters');


router.post("/register", authLimiter, registerUser);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-verification", otpLimiter, resendVerificationOtp);
router.post("/login", authLimiter, loginUser);
router.put("/password", authLimiter, protect, changePassword);
router.get("/users", protect, admin,  getUsers);


module.exports = router;
