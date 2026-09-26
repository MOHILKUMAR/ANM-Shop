const { rateLimit } = require('express-rate-limit');

const createLimiter = (limit, message, options = {}) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message },
    ...options,
});

const authLimiter = createLimiter(20, 'Too many account requests. Try again later.');
const otpLimiter = createLimiter(8, 'Too many verification attempts. Try again later.');
const paymentLimiter = createLimiter(12, 'Too many payment requests. Try again later.');
// Keyed by account (must run after `protect`) so one user can't drain the shared email quota
// that verification codes also depend on, even by switching IP addresses.
const invoiceEmailLimiter = createLimiter(5, 'Too many e-bill requests. Try again later.', {
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => `user:${req.user._id}`,
});

module.exports = { authLimiter, otpLimiter, paymentLimiter, invoiceEmailLimiter };
