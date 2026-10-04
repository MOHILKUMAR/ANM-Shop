// Stops simple form-filling bots on public forms that send emails (sign-up, forgot password,
// resend code), so they can't be used to flood someone's inbox or fill the database.
//   - Honeypot: the forms have a hidden "website" field that people never see or fill in.
//   - Timing: the forms send when they were opened; a person needs more than a moment to type.
// Bots get the same answer a person would, so they can't tell they were stopped. Scripts that
// call the API directly are limited by the rate limiters instead.
const MIN_FILL_MS = 2000;

const looksLikeBot = (body) => {
    if (typeof body.website === 'string' && body.website.trim() !== '') return true;
    const startedAt = Number(body.formStartedAt);
    // Only checked when sent (the forms always send it), and only if the clock looks sane.
    if (Number.isFinite(startedAt) && startedAt > 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= 0 && elapsed < MIN_FILL_MS) return true;
    }
    return false;
};

// `fakeSuccess(req, res)` sends what a real submission would have received.
const spamGuard = (fakeSuccess) => (req, res, next) => {
    if (!looksLikeBot(req.body)) return next();
    console.warn(`Blocked a likely bot on ${req.method} ${req.originalUrl}`);
    return fakeSuccess(req, res);
};

module.exports = { spamGuard, looksLikeBot };
