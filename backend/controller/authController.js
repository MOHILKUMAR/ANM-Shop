const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const Order = require('../model/Order');
const ChatConversation = require('../model/ChatConversation');
const Review = require('../model/Review');
const Ticket = require('../model/Ticket');
const Coupon = require('../model/Coupon');
const PaymentIntent = require('../model/PaymentIntent');
const { refreshProductRating } = require('../utils/reviews');
const sendEmail = require('../utils/sendEmail');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RESET_TTL_MS = 30 * 60 * 1000;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
// Reset links point at the storefront; FRONTEND_URL may list several origins.
const storefrontUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isValidNewPassword = (password) =>
    typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72;
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const hashOtp = (otp) => crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(otp)
    .digest('hex');

const issueVerificationOtp = async (user) => {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const text = `Your ANM-Shop verification code is ${otp}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656">Verify your ANM-Shop email</h1><p>Enter this code to finish creating your account:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#33252e">${otp}</p><p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p></div>`;
    const emailSent = await sendEmail(user.email, 'Your ANM-Shop verification code', text, html);
    if (!emailSent) return false;

    const sentAt = new Date();
    user.verificationOtpHash = hashOtp(otp);
    user.verificationOtpExpiresAt = new Date(sentAt.getTime() + OTP_TTL_MS);
    user.verificationOtpSentAt = sentAt;
    user.verificationOtpAttempts = 0;
    await user.save();
    return true;
};

const registerUser = async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;

    if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 ||
        typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ message: 'Enter a valid name/email and a password between 8 and 72 bytes' });
    }

    try {
        const existingUser = await User.findOne({ email }).select('+verificationOtpSentAt');
        if (existingUser?.verified) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        if (existingUser) {
            // An unverified account proves nobody controls the inbox yet, so the latest sign-up
            // replaces its password. Otherwise whoever registered first could keep a password
            // on an account the real owner later verifies and uses.
            existingUser.name = name;
            existingUser.password = hashedPassword;
            const sentAt = existingUser.verificationOtpSentAt?.getTime() || 0;
            const emailSent = Date.now() - sentAt < OTP_RESEND_WAIT_MS
                ? true
                : await issueVerificationOtp(existingUser);
            await existingUser.save();
            return res.status(201).json({
                message: emailSent
                    ? 'Enter the verification code sent to your email.'
                    : 'The verification email could not be sent. Check email configuration and request a new code.',
                email,
                emailSent,
            });
        }


        const user = await User.create({ name, email, password: hashedPassword });
        const emailSent = await issueVerificationOtp(user);

        return res.status(201).json({
            message: emailSent
                ? 'Account created. Enter the verification code sent to your email.'
                : 'Account created, but the email could not be sent. Check email configuration and request a new code.',
            email,
            emailSent,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }
        console.error('Registration error:', error.message);
        return res.status(500).json({ message: 'Unable to create account' });
    }
};

const verifyEmail = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
    const password = req.body.password;
    if (!email || !/^\d{6}$/.test(otp) || typeof password !== 'string' || !password ||
        Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ message: 'Enter the email address, 6-digit code, and your password' });
    }

    try {
        const user = await User.findOne({ email }).select(
            '+verificationOtpHash +verificationOtpExpiresAt +verificationOtpAttempts',
        );
        if (!user || user.verified || !user.verificationOtpHash) {
            return res.status(400).json({ message: 'The verification code is invalid or expired' });
        }
        if (user.verificationOtpAttempts >= MAX_OTP_ATTEMPTS) {
            return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
        }
        if (!user.verificationOtpExpiresAt || user.verificationOtpExpiresAt.getTime() < Date.now()) {
            return res.status(400).json({ message: 'The verification code has expired. Request a new code.' });
        }

        const expectedHash = Buffer.from(user.verificationOtpHash, 'hex');
        const receivedHash = Buffer.from(hashOtp(otp), 'hex');
        const otpMatches = expectedHash.length === receivedHash.length && crypto.timingSafeEqual(expectedHash, receivedHash);
        // The password check ties verification to whoever set the account's current password.
        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!otpMatches || !passwordMatches) {
            user.verificationOtpAttempts = (user.verificationOtpAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({
                message: 'The verification code or password is incorrect. If you signed up more than once, use the password from your latest sign-up.',
            });
        }

        user.verified = true;
        user.verificationOtpHash = undefined;
        user.verificationOtpExpiresAt = undefined;
        user.verificationOtpSentAt = undefined;
        user.verificationOtpAttempts = 0;
        await user.save();

        return res.json({
            message: 'Email verified successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        console.error('Email verification error:', error.message);
        return res.status(500).json({ message: 'Unable to verify email' });
    }
};

const resendVerificationOtp = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericResponse = { message: 'If an unverified account exists for this email, a code will be sent.' };
    if (!email) return res.json(genericResponse);

    try {
        const user = await User.findOne({ email, verified: false })
            .select('+verificationOtpSentAt');
        if (!user) return res.json(genericResponse);

        const sentAt = user.verificationOtpSentAt?.getTime() || 0;
        if (Date.now() - sentAt < OTP_RESEND_WAIT_MS) return res.json(genericResponse);

        await issueVerificationOtp(user);
        return res.json(genericResponse);
    } catch (error) {
        console.error('Resend verification error:', error.message);
        return res.status(500).json({ message: 'Unable to process the resend request' });
    }
};

const loginUser = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;

    try {
        const user = await User.findOne({ email });
        if (!user || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72 || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        if (!user.verified) {
            return res.status(403).json({
                message: 'Verify your email before signing in.',
                verificationRequired: true,
                email: user.email,
            });
        }

        return res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Login error:', error.message);
        return res.status(500).json({ message: 'Unable to sign in' });
    }
};

const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 72) {
        return res.status(400).json({ message: 'Enter your current password' });
    }
    if (!isValidNewPassword(newPassword)) {
        return res.status(400).json({ message: 'The new password must be between 8 and 72 bytes' });
    }
    if (newPassword === currentPassword) {
        return res.status(400).json({ message: 'Choose a new password that is different from the current one' });
    }

    try {
        // `protect` loads the user without the password hash.
        const user = await User.findById(req.user._id);
        // 400, not 401: the frontend treats 401 as "session expired" and signs the user out.
        if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(400).json({ message: 'Your current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        user.passwordChangedAt = new Date();
        user.passwordResetTokenHash = undefined; // an outstanding reset link is no longer needed
        user.passwordResetExpiresAt = undefined;
        await user.save();

        const text = `The password for your ANM-Shop account (${user.email}) was changed on ${user.passwordChangedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} (India time). You have been signed out on other devices. If you did not make this change, contact ANM-Shop support right away.`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656">Your password was changed</h1><p>${escapeHtml(text)}</p></div>`;
        // A failed notice shouldn't undo the change; it is only logged.
        sendEmail(user.email, 'Your ANM-Shop password was changed', text, html)
            .then((sent) => sent || console.error('Password change notice was not sent'))
            .catch((error) => console.error('Password change notice failed:', error.message));

        return res.json({
            message: 'Password changed. You have been signed out on other devices.',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        console.error('Change password error:', error.message);
        return res.status(500).json({ message: 'Unable to change password' });
    }
};

// Always answers the same way so the form can't be used to discover which emails have accounts.
const forgotPassword = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericResponse = { message: 'If an account exists for this email, a password reset link is on its way. It expires in 30 minutes.' };
    if (!email || email.length > 254) return res.json(genericResponse);

    try {
        const user = await User.findOne({ email }).select('+passwordResetSentAt');
        if (!user) return res.json(genericResponse);
        const lastSent = user.passwordResetSentAt?.getTime() || 0;
        if (Date.now() - lastSent < OTP_RESEND_WAIT_MS) return res.json(genericResponse);

        const token = crypto.randomBytes(32).toString('hex');
        const link = `${storefrontUrl()}/reset-password?token=${token}`;
        const text = `Someone asked to reset the password for your ANM-Shop account (${user.email}). Open this link within 30 minutes to choose a new password: ${link} If you didn't ask for this, ignore this email; your password stays the same.`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656">Reset your ANM-Shop password</h1><p>Someone asked to reset the password for your ANM-Shop account (${escapeHtml(user.email)}).</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#754656;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p>This link works once and expires in 30 minutes. If you didn't ask for this, ignore this email; your password stays the same.</p></div>`;

        const sentAt = new Date();
        user.passwordResetTokenHash = hashResetToken(token);
        user.passwordResetExpiresAt = new Date(sentAt.getTime() + RESET_TTL_MS);
        user.passwordResetSentAt = sentAt;
        await user.save();

        const sent = await sendEmail(user.email, 'Reset your ANM-Shop password', text, html);
        if (!sent) console.error('Password reset email could not be sent');
        return res.json(genericResponse);
    } catch (error) {
        console.error('Forgot password error:', error.message);
        return res.status(500).json({ message: 'Unable to process the request' });
    }
};

const resetPassword = async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const { password } = req.body;
    if (!/^[a-f\d]{64}$/.test(token)) {
        return res.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one.' });
    }
    if (!isValidNewPassword(password)) {
        return res.status(400).json({ message: 'The new password must be between 8 and 72 bytes' });
    }

    try {
        // Clearing the hash in the same atomic update makes each link single-use.
        const user = await User.findOneAndUpdate(
            { passwordResetTokenHash: hashResetToken(token), passwordResetExpiresAt: { $gt: new Date() } },
            {
                $set: {
                    password: await bcrypt.hash(password, 12),
                    passwordChangedAt: new Date(),
                    // Opening the emailed link proves the inbox, so this also verifies the account.
                    verified: true,
                },
                $unset: {
                    passwordResetTokenHash: 1,
                    passwordResetExpiresAt: 1,
                    verificationOtpHash: 1,
                    verificationOtpExpiresAt: 1,
                    verificationOtpSentAt: 1,
                    verificationOtpAttempts: 1,
                },
            },
            { returnDocument: 'after' },
        );
        if (!user) {
            return res.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one.' });
        }

        return res.json({
            message: 'Password reset. You have been signed out on other devices.',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        console.error('Reset password error:', error.message);
        return res.status(500).json({ message: 'Unable to reset password' });
    }
};

// Orders and payment records are kept (they show as "Deleted account"); the account's
// sign-in tokens stop working because `protect` no longer finds the user.
// Deletes an account with its chat history and reviews (recounting the affected products), all
// or nothing. Orders, payments and tickets stay as business records, as the privacy policy says;
// open tickets are closed, since replies could no longer reach anyone. A coupon meant only for
// this customer is switched off: with no customers left on it, it would be open to everyone.
const removeAccount = async (user) => {
    let reviewedProducts = [];
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            reviewedProducts = await Review.distinct('product', { user: user._id }).session(session);
            await Review.deleteMany({ user: user._id }, { session });
            await ChatConversation.deleteOne({ user: user._id }, { session });
            await Ticket.updateMany({ user: user._id, status: { $in: ['open', 'in_progress'] } }, { $set: { status: 'closed' } }, { session });
            const coupons = await Coupon.find({ applicableUsers: user._id }).select('applicableUsers').session(session).lean();
            const onlyTheirs = coupons.filter((coupon) => coupon.applicableUsers.length === 1).map((coupon) => coupon._id);
            await Coupon.updateMany({ _id: { $in: onlyTheirs } }, { $set: { isActive: false, showToCustomers: false } }, { session });
            await Coupon.updateMany({ applicableUsers: user._id }, { $pull: { applicableUsers: user._id } }, { session });
            await User.deleteOne({ _id: user._id }, { session });
        });
    } finally {
        await session.endSession();
    }
    await Promise.all(reviewedProducts.map((productId) => refreshProductRating(productId)));
};

// Why an account can't be deleted yet, or null: an order on its way (its customer could no longer
// follow it), a refund still owed to them, or a payment still being confirmed. Only checkouts
// touched in the last day count, so a record left stuck by an outage can't block it for good.
const RECENT_CHECKOUT_MS = 24 * 60 * 60 * 1000;
const deletionBlocker = async (userId) => {
    const [activeOrders, refundOwed, checkout] = await Promise.all([
        Order.countDocuments({ user: userId, status: { $in: ['pending', 'shipped'] } }),
        Order.exists({ user: userId, 'refund.status': { $in: ['pending', 'failed'] } }),
        // Paid, but the order hasn't been created yet (Razorpay is still confirming it), or a
        // checkout that couldn't become an order is being refunded.
        PaymentIntent.findOne({
            user: userId,
            updatedAt: { $gt: new Date(Date.now() - RECENT_CHECKOUT_MS) },
            $or: [{ status: 'pending', paymentId: { $type: 'string' } }, { status: 'refund_pending' }],
        }).select('status').lean(),
    ]);
    if (activeOrders) return { kind: 'orders', count: activeOrders };
    if (refundOwed) return { kind: 'refund' };
    if (checkout) return { kind: checkout.status === 'refund_pending' ? 'checkoutRefund' : 'payment' };
    return null;
};

const deleteUser = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (req.user._id.equals(req.params.id)) {
        return res.status(409).json({ message: "You can't delete your own account while signed in to it" });
    }

    try {
        const user = await User.findById(req.params.id).select('role');
        if (!user) return res.status(404).json({ message: 'Account not found' });
        if (user.role === 'admin') {
            return res.status(409).json({ message: "Admin accounts can't be deleted. Change their role to customer first." });
        }
        // The same checks as when customers delete their own account.
        const blocker = await deletionBlocker(user._id);
        if (blocker?.kind === 'orders') {
            return res.status(409).json({ message: `This customer has ${blocker.count} order${blocker.count === 1 ? '' : 's'} on the way. Cancel ${blocker.count === 1 ? 'it' : 'them'} (Orders tab) or wait for delivery before deleting the account.` });
        }
        if (blocker?.kind === 'refund') {
            return res.status(409).json({ message: 'A refund to this customer hasn’t gone through yet (Orders tab, Refund problems). Delete the account once it has been issued.' });
        }
        if (blocker?.kind === 'payment') {
            return res.status(409).json({ message: 'A payment from this customer is still being confirmed. Try again in a few minutes.' });
        }
        if (blocker?.kind === 'checkoutRefund') {
            return res.status(409).json({ message: 'A payment from this customer that couldn’t become an order is being refunded. Try again in a few minutes.' });
        }
        await removeAccount(user);
        return res.json({ message: 'Account deleted with their reviews. Their orders, payments, and tickets are kept as records.' });
    } catch (error) {
        console.error('Delete user error:', error.message);
        return res.status(500).json({ message: 'Unable to delete account' });
    }
};

// Every account with its order totals, newest first. Fields are allow-listed so password
// hashes and verification/reset secrets can never leak into this list or its Excel export.
const getUsers = async (req, res) => {
    try {
        const [users, orderStats] = await Promise.all([
            User.find({}).select('name email role verified').sort({ _id: -1 }).lean(),
            Order.aggregate([
                { $group: {
                    _id: '$user',
                    orderCount: { $sum: 1 },
                    // Cancelled and returned orders were refunded.
                    totalSpent: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 0, '$totalAmount'] } },
                    lastOrderAt: { $max: '$createdAt' },
                } },
            ]),
        ]);
        const statsByUser = new Map(orderStats.map((stats) => [String(stats._id), stats]));
        return res.json(users.map((user) => {
            const stats = statsByUser.get(String(user._id));
            return {
                ...user,
                // Accounts have no createdAt field; an ObjectId records when it was created.
                joinedAt: user._id.getTimestamp(),
                orderCount: stats?.orderCount || 0,
                totalSpent: stats?.totalSpent || 0,
                lastOrderAt: stats?.lastOrderAt || null,
            };
        }));
    } catch (error) {
        console.error('Fetch users error:', error.message);
        return res.status(500).json({ message: 'Unable to fetch users' });
    }
};

// DELETE /api/auth/me — a customer deletes their own account after confirming their password.
// Refused while an order, refund or payment is still in progress (deletionBlocker), and for
// admins, who must be made a customer by another admin first so the shop always keeps one.
const deleteMyAccount = async (req, res) => {
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!password) return res.status(400).json({ message: 'Enter your password to confirm' });
    try {
        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ message: 'Account not found' });
        if (!(await bcrypt.compare(password, user.password))) {
            // 400, not 401: a wrong password must not sign the person out.
            return res.status(400).json({ message: 'That password is not correct' });
        }
        if (user.role === 'admin') {
            return res.status(409).json({ message: 'Admin accounts can’t be deleted. Ask another admin to change your role to customer first.' });
        }
        const blocker = await deletionBlocker(user._id);
        if (blocker?.kind === 'orders') {
            const them = blocker.count === 1 ? 'it' : 'them';
            return res.status(409).json({ message: `You have ${blocker.count} order${blocker.count === 1 ? '' : 's'} on the way. Cancel ${them} on My orders or wait for delivery, then delete your account.` });
        }
        if (blocker?.kind === 'refund') {
            return res.status(409).json({ message: 'A refund to you is still being processed. You can delete your account once it has been issued (see My orders).' });
        }
        if (blocker?.kind === 'payment') {
            return res.status(409).json({ message: 'A payment of yours is still being confirmed. Try again in a few minutes, once its order appears on My orders.' });
        }
        if (blocker?.kind === 'checkoutRefund') {
            return res.status(409).json({ message: 'A payment of yours that couldn’t become an order is being refunded. Try again in a few minutes.' });
        }
        await removeAccount(user);
        const text = `Hi ${user.name},\n\nYour ANM-Shop account (${user.email}) has been deleted, with your reviews and chat history. Records of past orders and payments are kept as the law requires.\n\nIf you didn't do this, contact us by replying to this email.`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656;font-size:22px">Your account has been deleted</h1><p>Your ANM-Shop account (${escapeHtml(user.email)}) has been deleted, with your reviews and chat history. Records of past orders and payments are kept as the law requires.</p><p>If you didn't do this, contact us by replying to this email.</p></div>`;
        sendEmail(user.email, 'Your ANM-Shop account was deleted', text, html).catch(() => {});
        return res.json({ message: 'Your account has been deleted.' });
    } catch (error) {
        console.error('Delete own account error:', error.message);
        return res.status(500).json({ message: 'Unable to delete your account' });
    }
};

// PUT /api/auth/users/:id/role (admin) — make someone an admin or a customer. Admins can't change
// their own role, only verified accounts can become admins, and the last admin can't be removed.
const setUserRole = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Role must be user or admin' });
    if (req.user._id.equals(req.params.id)) return res.status(409).json({ message: 'You can’t change your own role' });
    try {
        const user = await User.findById(req.params.id).select('name email role verified');
        if (!user) return res.status(404).json({ message: 'Account not found' });
        if (role === 'admin' && !user.verified) {
            return res.status(409).json({ message: 'Only accounts with a verified email can become admins' });
        }
        const summary = () => ({ _id: user._id, name: user.name, email: user.email, role: user.role, verified: user.verified });
        if (user.role === role) {
            return res.json({ message: `${user.name} is already ${role === 'admin' ? 'an admin' : 'a customer'}`, user: summary() });
        }
        user.role = role;
        await user.save();
        // Two admins removing each other at the same moment must not leave the shop without one.
        if (role === 'user' && (await User.countDocuments({ role: 'admin' })) === 0) {
            user.role = 'admin';
            await user.save();
            return res.status(409).json({ message: 'The shop needs at least one admin' });
        }
        // The API applies the new role at once; the person's open browser shows it after they
        // sign in again (the signed-in page keeps the role it was given at sign-in).
        return res.json({
            message: `${user.name} is now ${role === 'admin' ? 'an admin' : 'a customer'}. If they're signed in, they'll see the change after signing out and back in.`,
            user: summary(),
        });
    } catch (error) {
        console.error('Set user role error:', error.message);
        return res.status(500).json({ message: 'Unable to change the role' });
    }
};

module.exports = {
    registerUser, verifyEmail, resendVerificationOtp, loginUser, changePassword,
    forgotPassword, resetPassword, deleteUser, getUsers, deleteMyAccount, setUserRole,
};
