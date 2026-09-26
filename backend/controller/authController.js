const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const Order = require('../model/Order');
const ChatConversation = require('../model/ChatConversation');
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

        const text = `The password for your ANM-Shop account (${user.email}) was changed on ${user.passwordChangedAt.toLocaleString('en-IN')}. You have been signed out on other devices. If you did not make this change, contact ANM-Shop support right away.`;
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
            return res.status(409).json({ message: "Admin accounts can't be deleted here" });
        }
        await user.deleteOne();
        // Chat history is personal; tickets stay with the orders and payments as records.
        await ChatConversation.deleteOne({ user: user._id });
        return res.json({ message: 'Account deleted. Their orders, payments, and tickets are kept as records.' });
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
                    totalSpent: { $sum: '$totalAmount' },
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

module.exports = {
    registerUser, verifyEmail, resendVerificationOtp, loginUser, changePassword,
    forgotPassword, resetPassword, deleteUser, getUsers,
};
