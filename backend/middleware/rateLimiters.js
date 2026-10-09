const { rateLimit, MemoryStore } = require('express-rate-limit');

// Every limiter keeps its counts in memory (per API instance). The stores are kept so the API
// tests can clear them between cases (resetRateLimits).
const stores = [];
const createLimiter = (limit, message, options = {}) => {
    const store = new MemoryStore();
    stores.push(store);
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message },
        store,
        ...options,
    });
};
const resetRateLimits = () => Promise.all(stores.map((store) => store.resetAll()));

const authLimiter = createLimiter(20, 'Too many account requests. Try again later.');
const otpLimiter = createLimiter(8, 'Too many verification attempts. Try again later.');
// New accounts from one network per hour, on top of authLimiter; stops mass sign-ups. Mobile
// networks in India put many customers behind one IP address, so a form mistake (400) or a server
// error doesn't count, and the cap leaves room for a shared network. "Email already in use" (409)
// does count, so the form can't be used to test which emails have accounts.
const signupLimiter = createLimiter(30, 'Too many new accounts from this network. Try again later.', {
    windowMs: 60 * 60 * 1000,
    skipFailedRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode < 400 || res.statusCode === 409,
});
const paymentLimiter = createLimiter(12, 'Too many payment requests. Try again later.');
// Keyed by account (must run after `protect`) so one user can't drain the shared email quota
// that verification codes also depend on, even by switching IP addresses.
const invoiceEmailLimiter = createLimiter(5, 'Too many e-bill requests. Try again later.', {
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => `user:${req.user._id}`,
});

// Per-account limits below also run after `protect`.
const perUser = { keyGenerator: (req) => `user:${req.user._id}` };
// Every chat message is a paid model call, so this caps what one account can spend.
const chatLimiter = createLimiter(30, 'You are sending messages too quickly. Wait a few minutes and try again.', perUser);
const ticketLimiter = createLimiter(5, 'Too many new tickets. Try again later.', { ...perUser, windowMs: 60 * 60 * 1000 });
const ticketReplyLimiter = createLimiter(30, 'Too many replies. Try again later.', perUser);
// Checkout re-prices the cart on every change and coupon attempt; this also slows code guessing.
const quoteLimiter = createLimiter(120, 'Too many price checks. Wait a few minutes and try again.', perUser);
const reviewLimiter = createLimiter(20, 'Too many review changes. Try again later.', { ...perUser, windowMs: 60 * 60 * 1000 });
// The cart and checkout pages look up current prices and stock; no sign-in needed, so by IP.
// One lookup per page visit, and a mobile network may put thousands of customers behind one IP,
// so the cap is high: it stops a script hammering the database, not shoppers.
const lookupLimiter = createLimiter(1500, 'Too many requests. Wait a few minutes and try again.');

module.exports = {
    authLimiter, otpLimiter, signupLimiter, paymentLimiter, invoiceEmailLimiter, chatLimiter, ticketLimiter, ticketReplyLimiter, quoteLimiter, reviewLimiter, lookupLimiter,
    resetRateLimits,
};
