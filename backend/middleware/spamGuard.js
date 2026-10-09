// Stops simple form-filling bots on public forms that send emails (sign-up, forgot password,
// resend code), so they can't be used to flood someone's inbox or fill the database.
//   - Honeypot: the forms have a hidden "leaveBlank" field that people never see or fill in.
//     It has a name browsers and password managers don't recognise, so autofill leaves it empty.
//   - Timing (sign-up only): the form sends how long it was open, measured by the browser's own
//     clock, so a device clock that is off doesn't matter. A person needs more than a moment to
//     type a name, email, and password. Short forms that autofill in one tap don't use it.
// Bots get the same answer a person would, so they can't tell they were stopped. Scripts that
// call the API directly are limited by the rate limiters instead.
const SIGNUP_MIN_FILL_MS = 2000;

const looksLikeBot = (body, minFillMs) => {
    if (typeof body.leaveBlank === 'string' && body.leaveBlank.trim() !== '') return true;
    const elapsed = Number(body.formElapsedMs);
    // Only checked when sent (the forms always send it).
    return minFillMs > 0 && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < minFillMs;
};

// `fakeSuccess(req, res)` sends what a real submission would have received.
const spamGuard = (fakeSuccess, { minFillMs = 0 } = {}) => (req, res, next) => {
    if (!looksLikeBot(req.body, minFillMs)) return next();
    console.warn(`Blocked a likely bot on ${req.method} ${req.originalUrl}`);
    return fakeSuccess(req, res);
};

module.exports = { spamGuard, looksLikeBot, SIGNUP_MIN_FILL_MS };
