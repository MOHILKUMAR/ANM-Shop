// Shared set-up for the API tests: an in-memory MongoDB replica set (transactions need one), a
// fake Razorpay, captured emails, and no access to backend/.env, so tests never touch real
// services or data. Load this file before anything else in a test.
const path = require('path');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-the-checks-0123456789';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';
for (const name of ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'EMAIL_USER', 'EMAIL_PASS', 'GEMINI_API_KEY', 'MONGO_URL', 'SHIPPING_FEE', 'FREE_SHIPPING_ABOVE']) {
    delete process.env[name];
}

// Never read backend/.env: it holds the real database and API keys.
const stub = (request, exports) => {
    const file = require.resolve(request, { paths: [path.join(__dirname, '..')] });
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('dotenv', { config: () => ({ parsed: {} }) });

// Emails are recorded instead of sent.
const sentEmails = [];
stub('./utils/sendEmail', async (to, subject, text, html) => {
    sentEmails.push({ to, subject, text, html });
    return true;
});

// A fake Razorpay that remembers orders, payments and refunds.
const razorpay = {
    orders: new Map(),
    payments: new Map(),
    refunds: [],
    failRefunds: false,
    reset() {
        this.orders.clear();
        this.payments.clear();
        this.refunds.length = 0;
        this.failRefunds = false;
    },
    // A captured payment for a Razorpay order, as the checkout window would produce.
    pay(orderId, { method = 'upi', status = 'captured' } = {}) {
        const order = this.orders.get(orderId);
        const id = `pay_${crypto.randomBytes(7).toString('hex')}`;
        this.payments.set(id, { id, order_id: orderId, amount: order.amount, currency: 'INR', status, method });
        const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${id}`).digest('hex');
        return { razorpay_order_id: orderId, razorpay_payment_id: id, razorpay_signature: signature };
    },
};
class FakeRazorpay {
    constructor() {
        this.orders = {
            create: async ({ amount, currency, receipt }) => {
                const order = { id: `order_${crypto.randomBytes(7).toString('hex')}`, amount, currency, receipt };
                razorpay.orders.set(order.id, order);
                return order;
            },
        };
        this.payments = {
            fetch: async (id) => {
                const payment = razorpay.payments.get(id);
                if (!payment) throw Object.assign(new Error('not found'), { statusCode: 400 });
                return { ...payment };
            },
            capture: async (id) => {
                const payment = razorpay.payments.get(id);
                payment.status = 'captured';
                return { ...payment };
            },
            refund: async (id, options) => {
                if (razorpay.failRefunds) throw Object.assign(new Error('refund failed'), { statusCode: 400 });
                const refund = { id: `rfnd_${crypto.randomBytes(7).toString('hex')}`, payment_id: id, amount: options?.amount ?? razorpay.payments.get(id)?.amount };
                razorpay.refunds.push(refund);
                return refund;
            },
        };
    }
}
stub('razorpay', FakeRazorpay);

// Photo uploads get a made-up Cloudinary URL instead of going to Cloudinary.
const uploads = [];
stub('./config/cloudinary', {
    uploader: {
        upload_stream: (options, callback) => ({
            end: (buffer) => {
                uploads.push(buffer);
                callback(null, { secure_url: `https://res.cloudinary.com/demo/image/upload/v1/test-${uploads.length}.jpg` });
            },
        }),
    },
});

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;
const startDb = async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(replSet.getUri());
    // Build every index now (e.g. the product text index) instead of in the background.
    await mongoose.connection.syncIndexes();
    const { ensureDefaultCategories, clearCategoryCache } = require('../utils/categories');
    clearCategoryCache();
    await ensureDefaultCategories();
};
const stopDb = async () => {
    await mongoose.disconnect();
    await replSet?.stop();
};
// Empties every collection and puts the default categories back.
const resetDb = async () => {
    const { ensureDefaultCategories, clearCategoryCache } = require('../utils/categories');
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
    clearCategoryCache();
    await ensureDefaultCategories();
    sentEmails.length = 0;
    razorpay.reset();
    await require('../middleware/rateLimiters').resetRateLimits();
};

const app = require('../app');
const request = require('supertest');
const api = () => request(app);

const User = require('../model/User');
const Product = require('../model/Product');

let userCount = 0;
// A verified account and a token for it.
const createUser = async ({ role = 'user', password = 'password123', ...rest } = {}) => {
    userCount += 1;
    const user = await User.create({
        name: rest.name || `Test User${userCount}`,
        email: rest.email || `user${userCount}@example.com`,
        password: await bcrypt.hash(password, 4),
        role,
        verified: true,
        ...rest,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return { user, token, auth: { Authorization: `Bearer ${token}` } };
};

const createProduct = (fields = {}) => Product.create({
    name: `Product ${crypto.randomBytes(3).toString('hex')}`,
    description: 'A product for the tests.',
    price: 200,
    category: 'Skincare',
    stock: 10,
    imageUrls: 'https://placehold.co/600x600',
    ...fields,
});

const address = {
    fullName: 'Priya Sharma', street: '12 MG Road', city: 'Delhi', postalCode: '110001', country: 'India', phone: '+91 98765 43210',
};

// Places a paid order through the real checkout endpoints and returns the order.
const placeOrder = async ({ auth }, items, { couponCode } = {}) => {
    const created = await api().post('/api/payment/order').set(auth).send({ items, address, couponCode });
    if (created.status !== 201) throw new Error(`create payment failed: ${created.status} ${JSON.stringify(created.body)}`);
    const verified = await api().post('/api/payment/verify').set(auth).send(razorpay.pay(created.body.razorpayOrderId));
    if (verified.status !== 201) throw new Error(`verify failed: ${verified.status} ${JSON.stringify(verified.body)}`);
    return verified.body.order || verified.body;
};

module.exports = { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, address, razorpay, sentEmails };
