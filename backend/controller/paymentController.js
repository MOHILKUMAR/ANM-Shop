const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Order = require('../model/Order');
const PaymentIntent = require('../model/PaymentIntent');
const Product = require('../model/Product');
const User = require('../model/User');
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

const isShortString = (value, maxLength = 100) =>
    typeof value === 'string' && value.length > 0 && value.length <= maxLength;

const hexSignatureMatches = (expectedHex, receivedHex) => {
    if (typeof receivedHex !== 'string' || !/^[a-f\d]{64}$/i.test(receivedHex)) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(receivedHex, 'hex'));
};

const populateOrder = (orderId) => Order.findById(orderId).populate('items.productId', 'name imageUrls');

const sendInvoiceFor = async (order, email) => {
    try {
        const sent = await sendOrderInvoice(order, email);
        if (sent) {
            await Order.updateOne({ _id: order._id }, { $set: { invoiceEmailSent: true } });
            order.invoiceEmailSent = true;
        }
        return sent;
    } catch (emailError) {
        console.error('Order e-bill email failed:', emailError.message || 'Email generation failed');
        return false;
    }
};

// Refunds a captured payment whose order could not be created (e.g. stock ran out while the
// customer was paying). The atomic pending -> refund_pending claim makes sure only one caller
// (the /verify request or the webhook) ever issues the refund.
const refundIntent = async (intentId, paymentId, reason) => {
    const claimed = await PaymentIntent.findOneAndUpdate(
        { _id: intentId, status: 'pending' },
        { $set: { status: 'refund_pending', paymentId, failureReason: reason } },
        { returnDocument: 'after' },
    );
    if (!claimed) return PaymentIntent.findById(intentId);

    try {
        const refund = await getRazorpay().payments.refund(paymentId, {
            amount: claimed.amountPaise,
            speed: 'normal',
            notes: { reason, checkout: String(claimed._id) },
        });
        claimed.status = 'refunded';
        claimed.refundId = refund.id;
    } catch (refundError) {
        // Needs manual action in the Razorpay dashboard; the intent keeps the paymentId.
        console.error(
            'AUTOMATIC REFUND FAILED - refund manually. Payment:', paymentId,
            refundError?.error?.description || refundError.message,
        );
        claimed.status = 'refund_failed';
    }
    await claimed.save();
    return claimed;
};

// Turns a captured payment into an order exactly once. Safe to run concurrently from
// /verify and the webhook: the transaction only proceeds while the intent is still
// 'pending', and Order.paymentId is unique, so the slower caller gets the existing order.
// Returns { order, created, intent }.
const fulfillPayment = async (intentId, paymentId) => {
    const session = await mongoose.startSession();
    let created = false;
    let outOfStock = false;
    try {
        await session.withTransaction(async () => {
            created = false;
            const intent = await PaymentIntent.findOne({ _id: intentId, status: 'pending' }).session(session);
            if (!intent) return; // already handled by another request

            for (const item of intent.items) {
                const updatedProduct = await Product.findOneAndUpdate(
                    { _id: item.productId, stock: { $gte: item.qty } },
                    { $inc: { stock: -item.qty } },
                    { returnDocument: 'after', session },
                );
                if (!updatedProduct) throw new Error('INSUFFICIENT_STOCK');
            }

            const [order] = await Order.create([{
                user: intent.user,
                items: intent.items,
                totalAmount: intent.amountPaise / 100,
                address: intent.address,
                paymentId,
            }], { session });

            intent.status = 'completed';
            intent.paymentId = paymentId;
            intent.order = order._id;
            await intent.save({ session });
            created = true;
        });
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') outOfStock = true;
        else if (error.code !== 11000) throw error; // 11000: the other caller won the race
    } finally {
        await session.endSession();
    }

    if (outOfStock) {
        const intent = await refundIntent(intentId, paymentId, 'Out of stock after payment');
        return { order: null, created: false, intent };
    }

    const intent = await PaymentIntent.findById(intentId);
    const order = intent?.order ? await populateOrder(intent.order) : null;
    return { order, created, intent };
};

const refundResponse = (res, intent) => {
    if (intent.status === 'refund_failed') {
        return res.status(409).json({
            message: `An item sold out while your payment was processing. We could not refund it automatically, so our team will refund payment ${intent.paymentId} manually. Please do not pay again.`,
            refunded: false,
        });
    }
    return res.status(409).json({
        message: 'An item sold out while your payment was processing. Your payment has been refunded automatically and should reach your account in 5–7 working days.',
        refunded: true,
    });
};

const verifyPayment = async (req, res) => {
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!isShortString(razorpayOrderId) || !isShortString(paymentId) || typeof signature !== 'string') {
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
        if (!hexSignatureMatches(expectedSignature, signature)) {
            return res.status(400).json({ message: 'Payment verification failed' });
        }

        if (intent.paymentId && intent.paymentId !== paymentId) {
            return res.status(409).json({ message: 'This checkout has already been completed' });
        }

        const razorpay = getRazorpay();
        let payment = await razorpay.payments.fetch(paymentId);
        if (
            payment.order_id !== razorpayOrderId ||
            Number(payment.amount) !== intent.amountPaise ||
            payment.currency !== 'INR'
        ) {
            return res.status(400).json({ message: 'Payment does not match this checkout' });
        }

        // Checkout can hand us a payment that is only authorized: auto-capture hasn't run yet,
        // or it is turned off for the account. The signature and amount are verified, so
        // capture it here instead of failing and inviting the customer to pay a second time.
        if (payment.status === 'authorized') {
            try {
                payment = await razorpay.payments.capture(paymentId, intent.amountPaise, 'INR');
            } catch (captureError) {
                // Usually auto-capture won the race; re-read the real status.
                console.error('Payment capture failed:', captureError?.error?.description || captureError.message);
                payment = await razorpay.payments.fetch(paymentId);
            }
        }

        if (payment.status === 'authorized') {
            // The payment.captured webhook creates the order once Razorpay finishes capturing.
            return res.status(202).json({
                pending: true,
                message: `Your payment (${paymentId}) was received and is still being confirmed. Your order will appear in Order History within a few minutes — please don't pay again.`,
            });
        }
        if (payment.status !== 'captured') {
            return res.status(400).json({ message: 'Payment has not been captured for this checkout' });
        }

        const result = await fulfillPayment(intent._id, paymentId);
        if (result.order) {
            const invoiceEmailSent = result.created
                ? await sendInvoiceFor(result.order, req.user.email)
                : Boolean(result.order.invoiceEmailSent);
            return res.status(result.created ? 201 : 200).json({
                message: result.created ? 'Payment verified and order created' : 'Payment already verified',
                invoiceEmailSent,
                order: result.order,
            });
        }
        if (result.intent?.status === 'completed') {
            // Paid and fulfilled earlier, but an admin has since deleted the order.
            return res.status(409).json({ message: 'This payment was already processed. Contact support about this order.' });
        }
        if (result.intent && result.intent.status !== 'pending') {
            return refundResponse(res, result.intent);
        }
        return res.status(500).json({ message: 'Unable to verify payment and create the order' });
    } catch (error) {
        console.error('Verify payment error:', Number(error?.statusCode) || 'unknown', error?.error?.code || error.message || 'provider error');
        return res.status(500).json({ message: 'Unable to verify payment and create the order' });
    }
};

// Server-to-server backup for /verify: if the customer closes the tab or loses network
// right after paying, Razorpay still tells us and the order is created here.
// Configure in Razorpay Dashboard -> Webhooks with the "payment.captured" event.
const razorpayWebhook = async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.error('Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET / API keys are not configured');
        return res.status(503).json({ message: 'Webhook not configured' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: 'Invalid webhook body' });
    }

    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');
    if (!hexSignatureMatches(expectedSignature, req.get('x-razorpay-signature'))) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    let event;
    try {
        event = JSON.parse(req.body.toString('utf8'));
    } catch {
        return res.status(400).json({ message: 'Invalid webhook body' });
    }

    if (event?.event !== 'payment.captured') return res.json({ status: 'ignored' });
    const payment = event.payload?.payment?.entity;
    if (!payment || !isShortString(payment.id) || !isShortString(payment.order_id)) {
        return res.json({ status: 'ignored' });
    }

    try {
        const intent = await PaymentIntent.findOne({ razorpayOrderId: payment.order_id });
        if (!intent) return res.json({ status: 'ignored' }); // not a checkout from this store
        if (Number(payment.amount) !== intent.amountPaise || payment.currency !== 'INR') {
            console.error('Webhook amount mismatch for Razorpay order', payment.order_id);
            return res.json({ status: 'ignored' });
        }
        if (intent.status !== 'pending') return res.json({ status: 'already_processed' });

        const result = await fulfillPayment(intent._id, payment.id);
        if (result.created) {
            const customer = await User.findById(intent.user).select('email');
            if (customer?.email) await sendInvoiceFor(result.order, customer.email);
        }
        return res.json({ status: result.order ? 'fulfilled' : result.intent?.status || 'processed' });
    } catch (error) {
        // Non-2xx makes Razorpay retry the webhook later.
        console.error('Razorpay webhook error:', error?.error?.code || error.message || 'unknown');
        return res.status(500).json({ message: 'Webhook processing failed' });
    }
};

const RECENT_CHECKOUT_MS = 24 * 60 * 60 * 1000;

// Admin cleanup of checkout records. Records that still matter for money are protected:
// a recent unpaid checkout may yet be paid (deleting it would leave a captured payment with
// no order and no automatic refund), and a refund_pending record is mid-refund. The admin
// UI warns before deleting refund_failed, which only changes once refunded by hand.
const deletePaymentRecord = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid payment record ID' });
    }
    try {
        const intent = await PaymentIntent.findById(req.params.id).select('status createdAt');
        if (!intent) return res.status(404).json({ message: 'Payment record not found' });
        if (intent.status === 'pending' && Date.now() - intent.createdAt.getTime() < RECENT_CHECKOUT_MS) {
            return res.status(409).json({ message: 'This checkout is less than 24 hours old and may still be paid. Try again later.' });
        }
        if (intent.status === 'refund_pending') {
            return res.status(409).json({ message: 'A refund for this payment is in progress. Try again once it finishes.' });
        }
        await intent.deleteOne();
        return res.json({ message: 'Payment record deleted' });
    } catch (error) {
        console.error('Delete payment record error:', error.message);
        return res.status(500).json({ message: 'Unable to delete payment record' });
    }
};

module.exports = { createdOrder, verifyPayment, razorpayWebhook, deletePaymentRecord };
