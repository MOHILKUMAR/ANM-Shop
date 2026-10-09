const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, razorpay, sentEmails } = require('./helpers');
const Product = require('../model/Product');
const Order = require('../model/Order');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');

before(startDb);
after(stopDb);
beforeEach(resetDb);

const line = (product, qty = 1) => ({ productId: String(product._id), qty });

test('a customer can cancel a pending order: full refund, stock back, coupon use back', async () => {
    const customer = await createUser();
    const product = await createProduct({ price: 300, stock: 5 });
    await Coupon.create({ code: 'ONCE', discountType: 'fixed', discountValue: 30, perUserLimit: 1 });
    const order = await placeOrder(customer, [line(product, 2)], { couponCode: 'ONCE' });
    assert.equal((await Product.findById(product._id)).stock, 3);
    sentEmails.length = 0;

    const res = await api().post(`/api/orders/${order._id}/cancel`).set(customer.auth).send({ reason: 'Ordered by mistake' });
    assert.equal(res.status, 200);
    assert.match(res.body.message, /refund of ₹570/);
    const saved = await Order.findById(order._id);
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.closedBy, 'customer');
    assert.equal(saved.refund.status, 'refunded');
    assert.equal(saved.refund.amount, 570);
    assert.equal(razorpay.refunds.length, 1);
    assert.equal(razorpay.refunds[0].amount, 57000, 'refunded in paise');
    assert.equal(razorpay.refunds[0].payment_id, order.paymentId);
    assert.equal((await Product.findById(product._id)).stock, 5);
    assert.equal((await Coupon.findOne({ code: 'ONCE' })).usedCount, 0);
    assert.equal((await CouponUsage.findOne({ user: customer.user._id })).count, 0);
    assert.equal(sentEmails.length, 1);
    assert.match(sentEmails[0].subject, /cancelled/);
    assert.equal(sentEmails[0].to, customer.user.email);
});

test('cancelling twice, someone else\'s order, or a shipped order is refused', async () => {
    const customer = await createUser();
    const stranger = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct();
    const first = await placeOrder(customer, [line(product)]);
    const second = await placeOrder(customer, [line(product)]);

    assert.equal((await api().post(`/api/orders/${first._id}/cancel`).set(stranger.auth)).status, 404);
    assert.equal((await api().post(`/api/orders/${first._id}/cancel`).set(customer.auth)).status, 200);
    const again = await api().post(`/api/orders/${first._id}/cancel`).set(customer.auth);
    assert.equal(again.status, 409);
    assert.equal(razorpay.refunds.length, 1, 'refunded only once');

    await api().put(`/api/orders/${second._id}/status`).set(admin.auth).send({ status: 'shipped' });
    const shipped = await api().post(`/api/orders/${second._id}/cancel`).set(customer.auth);
    assert.equal(shipped.status, 409);
    assert.match(shipped.body.message, /return/);
});

test('two cancellations at the same moment refund once', async () => {
    const customer = await createUser();
    const product = await createProduct();
    const order = await placeOrder(customer, [line(product)]);
    const results = await Promise.all([1, 2, 3].map(() => api().post(`/api/orders/${order._id}/cancel`).set(customer.auth)));
    assert.equal(results.filter((res) => res.status === 200).length, 1);
    assert.equal(razorpay.refunds.length, 1);
});

test('admins mark delivered orders as returned, choosing whether to restock', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct({ stock: 4 });
    const opened = await placeOrder(customer, [line(product)]);
    const unopened = await placeOrder(customer, [line(product)]);
    for (const order of [opened, unopened]) await api().put(`/api/orders/${order._id}/status`).set(admin.auth).send({ status: 'delivered' });

    assert.equal((await api().post(`/api/orders/${opened._id}/return`).set(customer.auth).send({})).status, 403, 'customers cannot');
    const noRestock = await api().post(`/api/orders/${opened._id}/return`).set(admin.auth).send({ restock: false, reason: 'Opened' });
    assert.equal(noRestock.status, 200);
    assert.equal((await Product.findById(product._id)).stock, 2);
    const restock = await api().post(`/api/orders/${unopened._id}/return`).set(admin.auth).send({ restock: true });
    assert.equal(restock.status, 200);
    assert.equal((await Product.findById(product._id)).stock, 3);
    assert.equal(razorpay.refunds.length, 2);
    assert.equal((await Order.findById(opened._id)).status, 'returned');

    const pending = await placeOrder(customer, [line(product)]);
    assert.equal((await api().post(`/api/orders/${pending._id}/return`).set(admin.auth).send({})).status, 409, 'not shipped yet');
    const reopen = await api().put(`/api/orders/${opened._id}/status`).set(admin.auth).send({ status: 'pending' });
    assert.equal(reopen.status, 409, 'a returned order stays returned');
});

test('a failed refund is recorded and can be retried by an admin', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct();
    const order = await placeOrder(customer, [line(product)]);

    razorpay.failRefunds = true;
    const cancelled = await api().post(`/api/orders/${order._id}/cancel`).set(customer.auth);
    assert.equal(cancelled.status, 200);
    assert.match(cancelled.body.message, /team has been notified/);
    assert.equal((await Order.findById(order._id)).refund.status, 'failed');

    assert.equal((await api().post(`/api/orders/${order._id}/refund`).set(admin.auth)).status, 502, 'still failing');
    razorpay.failRefunds = false;
    const retried = await api().post(`/api/orders/${order._id}/refund`).set(admin.auth);
    assert.equal(retried.status, 200);
    assert.equal((await Order.findById(order._id)).refund.status, 'refunded');
    assert.equal((await api().post(`/api/orders/${order._id}/refund`).set(admin.auth)).status, 409, 'nothing left to retry');
});

test('revenue excludes cancelled and returned orders', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct({ price: 500 });
    await placeOrder(customer, [line(product)]);
    const cancelled = await placeOrder(customer, [line(product)]);
    await api().post(`/api/orders/${cancelled._id}/cancel`).set(customer.auth);

    const stats = await api().get('/api/analytics').set(admin.auth);
    assert.equal(stats.body.totalRevenue, 500);
    assert.equal(stats.body.paidOrderCount, 1);
    assert.equal(stats.body.orderStatus.cancelled, 1);
});
