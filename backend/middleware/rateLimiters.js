const { rateLimit } = require('express-rate-limit');

const createLimiter = (limit, message) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message },
});

const authLimiter = createLimiter(20, 'Too many account requests. Try again later.');
const otpLimiter = createLimiter(8, 'Too many verification attempts. Try again later.');
const paymentLimiter = createLimiter(12, 'Too many payment requests. Try again later.');

module.exports = { authLimiter, otpLimiter, paymentLimiter };
