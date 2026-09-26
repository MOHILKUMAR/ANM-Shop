const express = require('express');
const router = express.Router();
const {
    registerUser, verifyEmail, resendVerificationOtp, loginUser, changePassword,
    forgotPassword, resetPassword, deleteUser, getUsers,
} = require("../controller/authController");
const {protect  } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiters');


router.post("/register", authLimiter, registerUser);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-verification", otpLimiter, resendVerificationOtp);
router.post("/login", authLimiter, loginUser);
router.put("/password", authLimiter, protect, changePassword);
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/reset-password", otpLimiter, resetPassword);
router.get("/users", protect, admin,  getUsers);
router.delete("/users/:id", protect, admin, deleteUser);


module.exports = router;
