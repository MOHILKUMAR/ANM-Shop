const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Order = require('../model/Order');
const PaymentIntent = require('../model/PaymentIntent');
const Product = require('../model/Product');
const sendOrderInvoice = require('../utils/sendOrderInvoice');
const beautyCategories = require('../constants/beautyCategories');

const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ADDRESS_LIMITS = { fullName: 120, street: 300, city: 100, postalCode: 24, country: 100, phone: 20 };
const isValidAddress = (address) => address &&
    Object.entries(ADDRESS_LIMITS).every(([field, maxLength]) =>
        typeof address[field] === 'string' && address[field].trim().length > 0 && address[field].trim().length <= maxLength,
    ) && /^\+?[1-9]\d{7,14}$/.test(address.phone.replace(/[\s()-]/g, ''));

const createdOrder = async (req, res) => {
    try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ message: 'Razorpay is not configured on the server' });
        }

        const { items, address } = req.body;
        if (!Array.isArray(items) || items.length === 0 || items.length > 50 || !isValidAddress(address)) {
            return res.status(400).json({ message: 'Items and a complete shipping address are required' });
        }

        const quantities = new Map();
        for (const item of items) {
            if (typeof item.productId !== 'string' || !mongoose.isValidObjectId(item.productId)) {
                return res.status(400).json({ message: 'Invalid product in cart' });
            }
            const productId = item.productId.toLowerCase();
            const qty = Number(item.qty);
            if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
                return res.status(400).json({ message: 'Item quantities must be between 1 and 99' });
            }
            const combinedQty = (quantities.get(productId) || 0) + qty;
            if (combinedQty > 99) {
                return res.status(400).json({ message: 'A product quantity cannot exceed 99' });
            }
            quantities.set(productId, combinedQty);
        }

        const productIds = [...quantities.keys()];
        const products = await Product.find({
            _id: { $in: productIds },
            category: { $in: beautyCategories },
        });
        if (products.length !== productIds.length) {
            return res.status(400).json({ message: 'One or more products are no longer available' });
        }

        const orderItems = [];
        let amountPaise = 0;
        for (const product of products) {
            const qty = quantities.get(product._id.toString());
            if (qty > product.stock) {
                return res.status(409).json({ message: `${product.name} does not have enough stock` });
            }
            const unitPricePaise = Math.round(Number(product.price) * 100);
            amountPaise += unitPricePaise * qty;
            orderItems.push({ productId: product._id, qty, price: unitPricePaise / 100 });
        }

        if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
            return res.status(400).json({ message: 'The order total is invalid' });
        }

        const razorpayOrder = await getRazorpay().orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: crypto.randomBytes(12).toString('hex'),
        });

        await PaymentIntent.create({
            user: req.user._id,
            items: orderItems,
            address: {
                ...Object.fromEntries(
                    ['fullName', 'street', 'city', 'postalCode', 'country']
                        .map((field) => [field, address[field].trim()]),
                ),
                phone: address.phone.replace(/[\s()-]/g, ''),
            },
            razorpayOrderId: razorpayOrder.id,
            amountPaise,
        });

        return res.status(201).json({
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        const statusCode = Number(error?.statusCode);
        console.error('Create payment order error:', statusCode || 'unknown', error?.error?.code || 'provider error');
        if (statusCode === 401) {
            return res.status(502).json({
                message: 'Razorpay rejected the configured API keys. Set a matching active test key ID and secret in backend/.env.',
            });
        }
        return res.status(500).json({ message: 'Unable to start checkout' });
    }
};

const verifyPayment = async (req, res) => {
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!razorpayOrderId || !paymentId || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) {
        return res.status(400).json({ message: 'Payment verification data is incomplete' });
    }

    try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ message: 'Razorpay is not configured on the server' });
        }

        const intent = await PaymentIntent.findOne({ razorpayOrderId, user: req.user._id });
        if (!intent) {
            return res.status(404).json({ message: 'Checkout session not found' });
        }

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpayOrderId}|${paymentId}`)
            .digest('hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const receivedBuffer = Buffer.from(signature, 'hex');
        if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
            return res.status(400).json({ message: 'Payment verification failed' });
        }

        const razorpay = getRazorpay();
        const payment = await razorpay.payments.fetch(paymentId);
        if (
            payment.order_id !== razorpayOrderId ||
            Number(payment.amount) !== intent.amountPaise ||
            payment.currency !== 'INR' ||
            payment.status !== 'captured'
        ) {
            return res.status(400).json({ message: 'Payment has not been captured for this checkout' });
        }

        if (intent.status === 'completed') {
            if (intent.paymentId !== paymentId) {
                return res.status(409).json({ message: 'This checkout has already been completed' });
            }
            const existingOrder = await Order.findById(intent.order).populate('items.productId', 'name imageUrls');
            return res.json({ message: 'Payment already verified', order: existingOrder });
        }

        const session = await mongoose.startSession();
        let order;
        try {
            await session.withTransaction(async () => {
                const currentIntent = await PaymentIntent.findOne({
                    _id: intent._id,
                    user: req.user._id,
                    status: 'pending',
                }).session(session);
                if (!currentIntent) {
                    throw new Error('CHECKOUT_ALREADY_PROCESSED');
                }

                for (const item of currentIntent.items) {
                    const updatedProduct = await Product.findOneAndUpdate(
                        { _id: item.productId, stock: { $gte: item.qty } },
                        { $inc: { stock: -item.qty } },
                        { new: true, session },
                    );
                    if (!updatedProduct) {
                        throw new Error('INSUFFICIENT_STOCK');
                    }
                }

                [order] = await Order.create([{
                    user: req.user._id,
                    items: currentIntent.items,
                    totalAmount: currentIntent.amountPaise / 100,
                    address: currentIntent.address,
                    paymentId,
                }], { session });

                currentIntent.status = 'completed';
                currentIntent.paymentId = paymentId;
                currentIntent.order = order._id;
                await currentIntent.save({ session });
            });
        } finally {
            await session.endSession();
        }

        order = await Order.findById(order._id).populate('items.productId', 'name imageUrls');
        let invoiceEmailSent = false;
        try {
            invoiceEmailSent = await sendOrderInvoice(order, req.user.email);
            if (invoiceEmailSent) {
                await Order.updateOne({ _id: order._id }, { $set: { invoiceEmailSent: true } });
                order.invoiceEmailSent = true;
            }
        } catch (emailError) {
            console.error('Order e-bill email failed:', emailError.message || 'Email generation failed');
        }

        return res.status(201).json({
            message: 'Payment verified and order created',
            invoiceEmailSent,
            order,
        });
    } catch (error) {
        console.error('Verify payment error:', Number(error?.statusCode) || 'unknown', error?.error?.code || 'provider error');
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(409).json({ message: 'Stock changed while payment was processing. Please contact support.' });
        }
        if (error.message === 'CHECKOUT_ALREADY_PROCESSED') {
            return res.status(409).json({ message: 'This checkout has already been processed' });
        }
        return res.status(500).json({ message: 'Unable to verify payment and create the order' });
    }
};

module.exports = { createdOrder, verifyPayment };
