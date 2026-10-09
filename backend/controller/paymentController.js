const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Order = require('../model/Order');
const PaymentIntent = require('../model/PaymentIntent');
const Product = require('../model/Product');
const User = require('../model/User');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
const sendOrderInvoice = require('../utils/sendOrderInvoice');
const { PricingError, priceCart, quoteForClient, describePaymentMethods } = require('../utils/pricing');

const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ADDRESS_LIMITS = { fullName: 120, street: 300, city: 100, postalCode: 24, country: 100, phone: 20 };
// 8 to 15 digits once spaces, brackets, and dashes are removed, optionally starting with +.
// The checkout form applies the same rule (frontend/src/pages/Checkout.jsx).
const isValidPhone = (phone) => /^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ''));
// The problem with the address, or null when it is complete.
const addressProblem = (address) => {
    const complete = address && Object.entries(ADDRESS_LIMITS).every(([field, maxLength]) =>
        typeof address[field] === 'string' && address[field].trim().length > 0 && address[field].trim().length <= maxLength,
    );
    if (!complete) return 'A complete shipping address is required';
    if (!isValidPhone(address.phone)) return 'Enter a valid mobile number with 8 to 15 digits, e.g. +91 98765 43210';
    // Indian PIN codes are 6 digits and never start with 0.
    if (/^india$/i.test(address.country.trim()) && !/^[1-9]\d{5}$/.test(address.postalCode.replace(/\s/g, ''))) {
        return 'Enter a valid 6-digit PIN code, e.g. 110001';
    }
    return null;
};

// Prices the cart (and an optional coupon) for the checkout page. The same calculation runs
// again when the payment is created, so the total shown is the total charged.
const quoteOrder = async (req, res) => {
    try {
        const priced = await priceCart({ user: req.user, items: req.body.items, couponCode: req.body.couponCode });
        return res.json(quoteForClient(priced));
    } catch (error) {
        if (error instanceof PricingError) return res.status(error.statusCode).json({ message: error.message, ...error.details });
        console.error('Quote error:', error.message);
        return res.status(500).json({ message: 'Unable to price your cart' });
    }
};

const createdOrder = async (req, res) => {
    try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ message: 'Razorpay is not configured on the server' });
        }

        const { items, address, couponCode } = req.body;
        const problem = addressProblem(address);
        if (problem) return res.status(400).json({ message: problem });

        const priced = await priceCart({ user: req.user, items, couponCode });
        // Never charge a different amount than the customer was shown.
        if (priced.couponError) return res.status(400).json({ message: priced.couponError, couponError: true });

        const razorpayOrder = await getRazorpay().orders.create({
            amount: priced.totalPaise,
            currency: 'INR',
            receipt: crypto.randomBytes(12).toString('hex'),
        });

        await PaymentIntent.create({
            user: req.user._id,
            items: priced.lines.map((line) => ({ productId: line.productId, qty: line.qty, price: line.unitPaise / 100 })),
            address: {
                ...Object.fromEntries(
                    ['fullName', 'street', 'city', 'postalCode', 'country']
                        .map((field) => [field, address[field].trim()]),
                ),
                phone: address.phone.replace(/[\s()-]/g, ''),
            },
            razorpayOrderId: razorpayOrder.id,
            amountPaise: priced.totalPaise,
            // subtotal + shipping - discount = amount: shipping is the fee before any coupon and
            // the discount is everything the coupon saved, waived shipping included.
            subtotalPaise: priced.subtotalPaise,
            shippingPaise: priced.shippingBasePaise,
            discountPaise: priced.savingsPaise,
            ...(priced.coupon ? {
                coupon: { id: priced.coupon._id, code: priced.coupon.code },
                allowedPaymentMethods: priced.coupon.paymentMethods || [],
            } : {}),
        });

        return res.status(201).json({
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            // The checkout window only offers these methods when the coupon requires them.
            allowedPaymentMethods: priced.coupon?.paymentMethods || [],
        });
    } catch (error) {
        if (error instanceof PricingError) return res.status(error.statusCode).json({ message: error.message, ...error.details });
        const statusCode = Number(error?.statusCode);
        console.error('Create payment order error:', statusCode || 'unknown', error?.error?.code || error.message || 'provider error');
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

// Why an order couldn't be created after payment; the message is shown to the customer and
// stored on the payment record for the admin.
class FulfillmentRefusal extends Error {}

// Coupon rules that can only be settled once the payment exists: the payment method, the total
// usage limit, and the per-customer limit. Runs inside the order transaction, so limits are
// never exceeded even when several customers pay at the same moment.
const redeemCoupon = async (intent, paymentMethod, session) => {
    if (!intent.coupon?.id) return;
    const { code } = intent.coupon;
    const allowed = intent.allowedPaymentMethods || [];
    if (allowed.length && !allowed.includes(paymentMethod)) {
        throw new FulfillmentRefusal(`Coupon ${code} only works with ${describePaymentMethods(allowed)} payments, but this payment was made by ${describePaymentMethods([paymentMethod || 'another method'])}.`);
    }

    const coupon = await Coupon.findById(intent.coupon.id).session(session);
    if (!coupon) return; // deleted by an admin after checkout started; honour the price shown
    const counted = await Coupon.findOneAndUpdate(
        { _id: coupon._id, $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
        { $inc: { usedCount: 1 } },
        { returnDocument: 'after', session },
    );
    if (!counted) throw new FulfillmentRefusal(`Coupon ${code} ran out of uses while your payment was processing.`);

    const usage = await CouponUsage.findOneAndUpdate(
        { coupon: coupon._id, user: intent.user, ...(coupon.perUserLimit ? { count: { $lt: coupon.perUserLimit } } : {}) },
        { $inc: { count: 1 } },
        { returnDocument: 'after', session },
    );
    if (!usage) throw new FulfillmentRefusal(`You had already used coupon ${code} the maximum number of times.`);
};

// Turns a captured payment into an order exactly once. Safe to run concurrently from
// /verify and the webhook: the transaction only proceeds while the intent is still
// 'pending', and Order.paymentId is unique, so the slower caller gets the existing order.
// Returns { order, created, intent }.
const fulfillPayment = async (intentId, paymentId, paymentMethod) => {
    // The per-customer usage counter must exist before the transaction starts: a transaction
    // reads from a snapshot and would not see a counter created part-way through it.
    const pending = await PaymentIntent.findOne({ _id: intentId, status: 'pending' }).select('coupon user').lean();
    if (pending?.coupon?.id) {
        await CouponUsage.updateOne(
            { coupon: pending.coupon.id, user: pending.user },
            { $setOnInsert: { count: 0 } },
            { upsert: true },
        ).catch((error) => {
            if (error.code !== 11000) throw error; // created by a concurrent checkout
        });
    }

    const session = await mongoose.startSession();
    let created = false;
    let refusal = null;
    try {
        await session.withTransaction(async () => {
            created = false;
            const intent = await PaymentIntent.findOne({ _id: intentId, status: 'pending' }).session(session);
            if (!intent) return; // already handled by another request

            await redeemCoupon(intent, paymentMethod, session);

            for (const item of intent.items) {
                const updatedProduct = await Product.findOneAndUpdate(
                    { _id: item.productId, stock: { $gte: item.qty } },
                    { $inc: { stock: -item.qty } },
                    { returnDocument: 'after', session },
                );
                if (!updatedProduct) throw new FulfillmentRefusal('An item sold out while your payment was processing.');
            }

            const [order] = await Order.create([{
                user: intent.user,
                items: intent.items,
                totalAmount: intent.amountPaise / 100,
                ...(intent.subtotalPaise !== undefined ? {
                    subtotalAmount: intent.subtotalPaise / 100,
                    // The fee before any coupon (a free-shipping coupon's saving is in the discount),
                    // worked out from the totals so the breakdown always adds up to what was paid,
                    // including on checkouts started before shipping was stored this way.
                    shippingFee: (intent.amountPaise - intent.subtotalPaise + intent.discountPaise) / 100,
                    discountAmount: intent.discountPaise / 100,
                } : {}),
                couponCode: intent.coupon?.code,
                paymentMethod,
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
        if (error instanceof FulfillmentRefusal) refusal = error.message;
        // A duplicate paymentId means /verify and the webhook raced and the other one won.
        else if (!(error.code === 11000 && error.keyPattern?.paymentId)) throw error;
    } finally {
        await session.endSession();
    }

    if (refusal) {
        const intent = await refundIntent(intentId, paymentId, refusal);
        return { order: null, created: false, intent };
    }

    const intent = await PaymentIntent.findById(intentId);
    const order = intent?.order ? await populateOrder(intent.order) : null;
    return { order, created, intent };
};

const refundResponse = (res, intent) => {
    const reason = intent.failureReason || 'Your order could not be completed.';
    if (intent.status === 'refund_failed') {
        return res.status(409).json({
            message: `${reason} We could not refund it automatically, so our team will refund payment ${intent.paymentId} manually. Please do not pay again.`,
            refunded: false,
        });
    }
    return res.status(409).json({
        message: `${reason} Your payment has been refunded automatically and should reach your account in 5–7 working days.`,
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

        const result = await fulfillPayment(intent._id, paymentId, payment.method);
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

        const result = await fulfillPayment(intent._id, payment.id, payment.method);
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

module.exports = { quoteOrder, createdOrder, verifyPayment, razorpayWebhook, deletePaymentRecord };
