const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const frontendOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET || '';
    if (jwtSecret.length < 32 || /your_|replace_with|secret_key/i.test(jwtSecret)) {
        throw new Error('Production requires a strong, unique JWT_SECRET of at least 32 characters');
    }
    if (frontendOrigins.length === 0) {
        throw new Error('Production requires FRONTEND_URL to be configured');
    }
    for (const origin of frontendOrigins) {
        let parsedOrigin;
        try {
            parsedOrigin = new URL(origin);
        } catch {
            throw new Error('FRONTEND_URL must contain valid origin URLs');
        }
        if (parsedOrigin.protocol !== 'https:') {
            throw new Error('Production FRONTEND_URL origins must use HTTPS');
        }
    }
}

// In development, accept the frontend on any local port (Vite may pick 5174, preview uses 4173, etc.)
const isLocalDevOrigin = (origin) =>
    !isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.disable('x-powered-by');
// Hosts like Render/Railway sit behind one reverse proxy. Without this, every request
// appears to come from the proxy IP and all users share a single rate-limit bucket.
// Set TRUST_PROXY to the number of proxy hops in front of the API (0 = none).
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(helmet());
app.use(cors({
    origin(origin, callback) {
        if (!origin || frontendOrigins.includes(origin) || isLocalDevOrigin(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS'));
    },
}));
// Razorpay webhook signatures are computed over the exact raw body, so this route
// must be registered before express.json() parses it.
app.post(
    '/api/payment/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    require('./controller/paymentController').razorpayWebhook,
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 50 }));

app.get('/', (req, res) => {
    res.json({ service: 'ANM-Shop API', status: 'ok' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/analytics', require('./routes/analyticRoutes'));
app.use('/api/admin/search', require('./routes/searchRoutes'));
app.use('/api/tickets', require('./routes/ticketRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const status = Number(error.statusCode || error.status) || 500;
    if (status >= 500) console.error('API request error:', error.message || 'Unexpected server error');
    if (error.name === 'MulterError') {
        return res.status(400).json({
            message: error.code === 'LIMIT_FILE_SIZE'
                ? 'Image must be 5 MB or smaller'
                : 'Invalid image upload',
        });
    }
    if (error.message === 'Origin is not allowed by CORS') {
        return res.status(403).json({ message: 'Origin is not allowed' });
    }
    return res.status(status >= 400 && status < 600 ? status : 500).json({
        message: status >= 500 ? 'Internal server error' : 'Request could not be processed',
    });
});

const PORT = process.env.PORT || 5000;
const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
});
