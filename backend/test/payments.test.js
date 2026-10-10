const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, address, razorpay, sentEmails } = require('./helpers');
const Product = require('../model/Product');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
const Order = require('../model/Order');
const PaymentIntent = require('../model/PaymentIntent');
const { serializePayment } = require('../utils/supportAssistant');

before(startDb);
after(stopDb);
beforeEach(resetDb);

const quote = (customer, items, couponCode) => api().post('/api/payment/quote').set(customer.auth).send({ items, couponCode });
const line = (product, qty = 1) => ({ productId: String(product._id), qty });

test('shipping is ₹49 below ₹499 and free from ₹499', async () => {
    const customer = await createUser();
    const product = await createProduct({ price: 200 });
    const small = await quote(customer, [line(product, 1)]);
    assert.equal(small.status, 200);
    assert.deepEqual([small.body.subtotal, small.body.shipping, small.body.total], [200, 49, 249]);
    const large = await quote(customer, [line(product, 3)]);
    assert.deepEqual([large.body.subtotal, large.body.shipping, large.body.total], [600, 0, 600]);
});

test('coupon types: percentage with cap, fixed, free shipping, buy X get Y', async () => {
    const customer = await createUser();
    const cream = await createProduct({ price: 300 });
    const balm = await createProduct({ price: 100 });
    await Coupon.create([
        { code: 'TEN', discountType: 'percentage', discountValue: 10, maxDiscount: 50 },
        { code: 'FLAT75', discountType: 'fixed', discountValue: 75 },
        { code: 'SHIPFREE', discountType: 'free_shipping' },
        { code: 'B2G1', discountType: 'buy_x_get_y', buyQuantity: 2, getQuantity: 1 },
    ]);

    const ten = await quote(customer, [line(cream, 3)], 'TEN');
    assert.equal(ten.body.discount, 50, '10% of ₹900 is ₹90, capped at ₹50');
    const fixed = await quote(customer, [line(balm, 1)], 'flat75');
    assert.deepEqual([fixed.body.discount, fixed.body.total], [75, 100 + 49 - 75]);
    const ship = await quote(customer, [line(balm, 1)], 'SHIPFREE');
    assert.deepEqual([ship.body.shipping, ship.body.savings, ship.body.total], [0, 49, 100]);
    const alreadyFree = await quote(customer, [line(cream, 2)], 'SHIPFREE');
    assert.match(alreadyFree.body.couponError, /already ships free/);
    const b2g1 = await quote(customer, [line(cream, 2), line(balm, 1)], 'B2G1');
    assert.equal(b2g1.body.discount, 100, 'the cheapest unit of the group of 3 is free');
});

test('coupon rules: minimum cart, dates, usage limits, eligible categories', async () => {
    const customer = await createUser();
    const serum = await createProduct({ price: 200, category: 'Skincare' });
    const comb = await createProduct({ price: 200, category: 'Tools & Accessories' });
    await Coupon.create([
        { code: 'MIN500', discountType: 'fixed', discountValue: 50, minCartValue: 500 },
        { code: 'OLD', discountType: 'fixed', discountValue: 50, expiresAt: new Date(Date.now() - 1000) },
        { code: 'SOON', discountType: 'fixed', discountValue: 50, startsAt: new Date(Date.now() + 86400000) },
        { code: 'GONE', discountType: 'fixed', discountValue: 50, usageLimit: 1, usedCount: 1 },
        { code: 'PAUSED', discountType: 'fixed', discountValue: 50, isActive: false },
        { code: 'SKIN20', discountType: 'percentage', discountValue: 20, applicableCategories: ['Skincare'] },
    ]);
    assert.match((await quote(customer, [line(serum)], 'MIN500')).body.couponError, /Add ₹300 more/);
    assert.match((await quote(customer, [line(serum)], 'OLD')).body.couponError, /expired/);
    assert.match((await quote(customer, [line(serum)], 'SOON')).body.couponError, /starts on/);
    assert.match((await quote(customer, [line(serum)], 'GONE')).body.couponError, /usage limit/);
    assert.match((await quote(customer, [line(serum)], 'PAUSED')).body.couponError, /not available/);
    assert.match((await quote(customer, [line(serum)], 'NOPE')).body.couponError, /not found/);
    const skin = await quote(customer, [line(serum), line(comb)], 'SKIN20');
    assert.equal(skin.body.discount, 40, 'only the skincare item counts');
});

test('paying creates the order, takes stock, records coupon use and emails the bill', async () => {
    const customer = await createUser();
    const product = await createProduct({ price: 250, stock: 5 });
    await Coupon.create({ code: 'ONCE', discountType: 'fixed', discountValue: 20, perUserLimit: 1 });

    const order = await placeOrder(customer, [line(product, 2)], { couponCode: 'ONCE' });
    assert.equal(order.totalAmount, 480);
    assert.equal(order.subtotalAmount + order.shippingFee - order.discountAmount, order.totalAmount);
    assert.equal((await Product.findById(product._id)).stock, 3);
    assert.equal((await Coupon.findOne({ code: 'ONCE' })).usedCount, 1);
    assert.equal((await CouponUsage.findOne({ user: customer.user._id })).count, 1);
    assert.equal(sentEmails.length, 1);
    assert.match(sentEmails[0].subject, /bill|receipt|order/i);
    assert.match((await quote(customer, [line(product)], 'ONCE')).body.couponError, /maximum number of times/);
});

test('a free-shipping coupon order keeps a breakdown that adds up', async () => {
    const customer = await createUser();
    const product = await createProduct({ price: 100 });
    await Coupon.create({ code: 'SHIPFREE', discountType: 'free_shipping' });
    const order = await placeOrder(customer, [line(product)], { couponCode: 'SHIPFREE' });
    assert.deepEqual([order.subtotalAmount, order.shippingFee, order.discountAmount, order.totalAmount], [100, 49, 49, 100]);
});

test('an item that sells out during payment is refunded automatically', async () => {
    const customer = await createUser();
    const product = await createProduct({ stock: 1 });
    const created = await api().post('/api/payment/order').set(customer.auth).send({ items: [line(product)], address });
    assert.equal(created.status, 201);
    await Product.updateOne({ _id: product._id }, { stock: 0 }); // someone else bought it

    const verified = await api().post('/api/payment/verify').set(customer.auth).send(razorpay.pay(created.body.razorpayOrderId));
    assert.equal(verified.status, 409);
    assert.equal(verified.body.refunded, true);
    assert.equal(razorpay.refunds.length, 1);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await PaymentIntent.findOne()).status, 'refunded');
});

test('verify and the webhook together create exactly one order', async () => {
    const customer = await createUser();
    const product = await createProduct();
    const created = await api().post('/api/payment/order').set(customer.auth).send({ items: [line(product)], address });
    const paid = razorpay.pay(created.body.razorpayOrderId);

    const payment = razorpay.payments.get(paid.razorpay_payment_id);
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } });
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    const bad = await api().post('/api/payment/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'f'.repeat(64)).send(body);
    assert.equal(bad.status, 400);
    const hook = await api().post('/api/payment/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(body);
    assert.equal(hook.body.status, 'fulfilled');

    const verified = await api().post('/api/payment/verify').set(customer.auth).send(paid);
    assert.equal(verified.status, 200, 'already verified');
    assert.equal(await Order.countDocuments(), 1);
});

test('a payment Razorpay is still confirming is noted on the checkout and described as paid', async () => {
    const customer = await createUser();
    const product = await createProduct();
    const checkout = await api().post('/api/payment/order').set(customer.auth).send({ items: [{ productId: String(product._id), qty: 1 }], address });
    const abandoned = await api().post('/api/payment/order').set(customer.auth).send({ items: [{ productId: String(product._id), qty: 1 }], address });

    razorpay.failCaptures = true;
    const paid = razorpay.pay(checkout.body.razorpayOrderId, { status: 'authorized' });
    const verified = await api().post('/api/payment/verify').set(customer.auth).send(paid);
    assert.equal(verified.status, 202);
    assert.equal(await Order.countDocuments(), 0, 'the webhook creates the order later');

    const intent = await PaymentIntent.findOne({ razorpayOrderId: checkout.body.razorpayOrderId });
    assert.equal(intent.status, 'pending');
    assert.equal(intent.paymentId, paid.razorpay_payment_id);
    assert.equal(serializePayment(intent).status, 'paid but being confirmed');
    assert.equal(serializePayment(await PaymentIntent.findOne({ razorpayOrderId: abandoned.body.razorpayOrderId })).status, 'awaiting payment');
});

test('a forged payment signature is rejected', async () => {
    const customer = await createUser();
    const product = await createProduct();
    const created = await api().post('/api/payment/order').set(customer.auth).send({ items: [line(product)], address });
    const paid = razorpay.pay(created.body.razorpayOrderId);
    const res = await api().post('/api/payment/verify').set(customer.auth).send({ ...paid, razorpay_signature: '0'.repeat(64) });
    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
});
