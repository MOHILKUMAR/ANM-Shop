const express = require('express');
const router = express.Router();
const {
    registerUser, verifyEmail, resendVerificationOtp, loginUser, changePassword,
    forgotPassword, resetPassword, deleteUser, getUsers,
} = require("../controller/authController");
const {protect  } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { authLimiter, otpLimiter, signupLimiter } = require('../middleware/rateLimiters');
const { spamGuard, SIGNUP_MIN_FILL_MS } = require('../middleware/spamGuard');

// What a person would have been told, so a stopped bot can't tell the difference.
const fakeSignup = (req, res) => res.status(201).json({
    message: 'Account created. Enter the verification code sent to your email.',
    email: typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '',
    emailSent: true,
});
const fakeResetRequest = (req, res) => res.json({ message: 'If an account exists for this email, a password reset link is on its way. It expires in 30 minutes.' });
const fakeResend = (req, res) => res.json({ message: 'If an unverified account exists for this email, a code will be sent.' });

router.post("/register", authLimiter, signupLimiter, spamGuard(fakeSignup, { minFillMs: SIGNUP_MIN_FILL_MS }), registerUser);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-verification", otpLimiter, spamGuard(fakeResend), resendVerificationOtp);
router.post("/login", authLimiter, loginUser);
router.put("/password", authLimiter, protect, changePassword);
router.post("/forgot-password", otpLimiter, spamGuard(fakeResetRequest), forgotPassword);
router.post("/reset-password", otpLimiter, resetPassword);
router.get("/users", protect, admin,  getUsers);
router.delete("/users/:id", protect, admin, deleteUser);


module.exports = router;
