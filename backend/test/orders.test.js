const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, razorpay, sentEmails } = require('./helpers');
const Product = require('../model/Product');
const Order = require('../model/Order');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
const Review = require('../model/Review');

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

test('a failed refund alerts the admins, is listed and kept, and can be retried', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct();
    const order = await placeOrder(customer, [line(product)]);
    sentEmails.length = 0;

    razorpay.failRefunds = true;
    const cancelled = await api().post(`/api/orders/${order._id}/cancel`).set(customer.auth);
    assert.equal(cancelled.status, 200);
    assert.match(cancelled.body.message, /We’ve been alerted/);
    assert.equal((await Order.findById(order._id)).refund.status, 'failed');
    assert.ok(sentEmails.some((email) => email.to === admin.user.email && /Refund failed/.test(email.subject)), 'admins are emailed');

    const problems = await api().get('/api/orders').set(admin.auth).query({ refund: 'problem' });
    assert.equal(problems.body.refundProblems, 1);
    assert.deepEqual(problems.body.orders.map((listed) => listed._id), [String(order._id)]);
    assert.equal((await api().delete(`/api/orders/${order._id}`).set(admin.auth)).status, 409, 'the record of money owed is kept');

    assert.equal((await api().post(`/api/orders/${order._id}/refund`).set(admin.auth)).status, 502, 'still failing');
    razorpay.failRefunds = false;
    const retried = await api().post(`/api/orders/${order._id}/refund`).set(admin.auth);
    assert.equal(retried.status, 200);
    assert.equal((await Order.findById(order._id)).refund.status, 'refunded');
    assert.equal((await api().post(`/api/orders/${order._id}/refund`).set(admin.auth)).status, 409, 'nothing left to retry');
    assert.equal((await api().get('/api/orders').set(admin.auth)).body.refundProblems, 0);
    assert.equal((await api().delete(`/api/orders/${order._id}`).set(admin.auth)).status, 200);
});

test('retrying records a refund Razorpay already made instead of refunding again', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct({ price: 400 });
    const interrupted = await placeOrder(customer, [line(product)]);
    const byHand = await placeOrder(customer, [line(product)]);

    // Refunded at Razorpay, but a restart stopped it being recorded.
    await api().post(`/api/orders/${interrupted._id}/cancel`).set(customer.auth);
    const madeId = razorpay.refunds[0].id;
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    await Order.updateOne({ _id: interrupted._id }, { $set: { 'refund.status': 'pending', 'refund.requestedAt': twentyMinutesAgo }, $unset: { 'refund.razorpayRefundId': 1 } });
    const recovered = await api().post(`/api/orders/${interrupted._id}/refund`).set(admin.auth);
    assert.equal(recovered.status, 200);
    assert.equal((await Order.findById(interrupted._id)).refund.razorpayRefundId, madeId);

    // Failed here, then refunded by hand in the Razorpay dashboard (no notes).
    razorpay.failRefunds = true;
    await api().post(`/api/orders/${byHand._id}/cancel`).set(customer.auth);
    const manual = razorpay.refundMadeAt(byHand.paymentId, Math.round(byHand.totalAmount * 100));
    razorpay.refunds.push(manual);
    const recorded = await api().post(`/api/orders/${byHand._id}/refund`).set(admin.auth);
    assert.equal(recorded.status, 200);
    assert.equal((await Order.findById(byHand._id)).refund.razorpayRefundId, manual.id);
    assert.equal(razorpay.refunds.length, 2, 'no second refund for either order');
});

test('a long return reason is cut down to what Razorpay accepts in a note', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const order = await placeOrder(customer, [line(await createProduct())]);
    await api().put(`/api/orders/${order._id}/status`).set(admin.auth).send({ status: 'delivered' });

    const reason = 'The customer says the product arrived damaged. '.repeat(6).slice(0, 290).trim();
    assert.ok(reason.length > 256);
    const returned = await api().post(`/api/orders/${order._id}/return`).set(admin.auth).send({ reason });
    assert.equal(returned.status, 200);
    const saved = await Order.findById(order._id);
    assert.equal(saved.refund.status, 'refunded');
    assert.equal(saved.refund.reason, reason, 'the full reason is kept on the order');
    assert.ok(razorpay.refunds[0].notes.reason.length <= 256);
});

test('a status change at the same moment as a cancellation never reopens the refunded order', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct({ stock: 50 });
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const order = await placeOrder(customer, [line(product)]);
        await Promise.all([
            api().post(`/api/orders/${order._id}/cancel`).set(customer.auth),
            api().put(`/api/orders/${order._id}/status`).set(admin.auth).send({ status: 'shipped' }),
        ]);
        const saved = await Order.findById(order._id);
        if (saved.refund?.status) assert.equal(saved.status, 'cancelled', 'a refunded order stays cancelled');
        else assert.equal(saved.status, 'shipped', 'or it shipped first and was not cancelled');
    }
});

test('cancelling gives the use back to the coupon that was used, even after a rename', async () => {
    const customer = await createUser();
    const product = await createProduct({ price: 300, stock: 5 });
    const original = await Coupon.create({ code: 'SAVE10', discountType: 'fixed', discountValue: 10, perUserLimit: 1 });
    const first = await placeOrder(customer, [line(product)], { couponCode: 'SAVE10' });
    // The admin renames it and makes a new coupon with the old code, which the customer uses too.
    await Coupon.updateOne({ _id: original._id }, { $set: { code: 'OLD10' } });
    const replacement = await Coupon.create({ code: 'SAVE10', discountType: 'fixed', discountValue: 10, perUserLimit: 1 });
    await placeOrder(customer, [line(product)], { couponCode: 'SAVE10' });

    assert.equal((await api().post(`/api/orders/${first._id}/cancel`).set(customer.auth)).status, 200);
    assert.equal((await Coupon.findById(original._id)).usedCount, 0, 'the coupon used on the cancelled order');
    assert.equal((await Coupon.findById(replacement._id)).usedCount, 1, 'the new coupon is untouched');
    assert.equal((await CouponUsage.findOne({ coupon: replacement._id, user: customer.user._id })).count, 1);
});

test('cancelled orders lose the verified-buyer badge and the e-bill, and leave the customer total', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct({ price: 250 });
    const order = await placeOrder(customer, [line(product)]);
    const review = await api().post(`/api/products/${product._id}/reviews`).set(customer.auth).send({ rating: 'excellent', comment: 'Lovely texture, works well.' });
    assert.equal(review.status, 201);
    assert.equal((await Review.findOne({ user: customer.user._id })).verifiedBuyer, true);

    await api().post(`/api/orders/${order._id}/cancel`).set(customer.auth);
    assert.equal((await Review.findOne({ user: customer.user._id })).verifiedBuyer, false);
    assert.equal((await api().post(`/api/orders/${order._id}/resend-invoice`).set(customer.auth)).status, 409);
    const search = await api().get('/api/admin/search').set(admin.auth).query({ q: customer.user.email });
    assert.equal(search.body.customers[0].totalSpent, 0);
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
