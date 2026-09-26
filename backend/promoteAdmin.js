const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./model/User');

dotenv.config();

const promoteAdmin = async () => {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
        throw new Error('Set ADMIN_EMAIL in backend/.env to the existing ANM-Shop account to promote');
    }

    await connectDB();
    const user = await User.findOneAndUpdate(
        { email },
        {
            $set: { role: 'admin', verified: true },
            $unset: {
                verificationOtpHash: 1,
                verificationOtpExpiresAt: 1,
                verificationOtpSentAt: 1,
                verificationOtpAttempts: 1,
            },
        },
        { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
        throw new Error('No ANM-Shop account found for ADMIN_EMAIL. Register the account first, then rerun this command.');
    }

    console.log('Admin role granted. Sign in with this account’s existing ANM-Shop password.');
};

promoteAdmin()
    .catch((error) => {
        console.error('Admin promotion failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
