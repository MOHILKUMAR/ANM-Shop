const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const sendEmail = require('../utils/sendEmail');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
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
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                message: existingUser.verified
                    ? 'An account with this email already exists'
                    : 'An account exists but is not verified. Verify your email or request a new code.',
                verificationRequired: !existingUser.verified,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
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
    if (!email || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: 'Enter the email address and 6-digit code' });
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
        if (expectedHash.length !== receivedHash.length || !crypto.timingSafeEqual(expectedHash, receivedHash)) {
            user.verificationOtpAttempts = (user.verificationOtpAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({ message: 'The verification code is incorrect' });
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

const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select(
            '-password -verificationOtpHash -verificationOtpExpiresAt -verificationOtpSentAt -verificationOtpAttempts',
        );
        return res.json(users);
    } catch (error) {
        return res.status(500).json({ message: 'Unable to fetch users' });
    }
};

module.exports = { registerUser, verifyEmail, resendVerificationOtp, loginUser, getUsers };
