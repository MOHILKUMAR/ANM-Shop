const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, address, razorpay, sentEmails } = require('./helpers');
const User = require('../model/User');
const Review = require('../model/Review');
const Order = require('../model/Order');
const Product = require('../model/Product');
const Ticket = require('../model/Ticket');
const ChatConversation = require('../model/ChatConversation');
const Coupon = require('../model/Coupon');
const PaymentIntent = require('../model/PaymentIntent');

before(startDb);
after(stopDb);
beforeEach(resetDb);

const line = (product, qty = 1) => ({ productId: String(product._id), qty });

test('a customer deletes their own account after confirming the password', async () => {
    const customer = await createUser({ password: 'correct-horse-1' });
    const product = await createProduct();
    const order = await placeOrder(customer, [line(product)]);
    const admin = await createUser({ role: 'admin' });
    await api().put(`/api/orders/${order._id}/status`).set(admin.auth).send({ status: 'delivered' });
    const review = await api().post(`/api/products/${product._id}/reviews`).set(customer.auth).send({ rating: 'excellent', comment: 'Lovely texture and scent.' });
    assert.equal(review.status, 201);
    const other = await createUser();
    await placeOrder(other, [line(product)]);
    await api().post(`/api/products/${product._id}/reviews`).set(other.auth).send({ rating: 'good', comment: 'Nice, a bit pricey.' });
    const ticket = await Ticket.create({ user: customer.user._id, subject: 'Where is my parcel?', category: 'delivery', description: 'It has not arrived yet.' });
    await ChatConversation.create({ user: customer.user._id });
    sentEmails.length = 0;

    assert.equal((await api().delete('/api/auth/me').set(customer.auth).send({ password: 'wrong' })).status, 400);
    const res = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'correct-horse-1' });
    assert.equal(res.status, 200);
    assert.equal(await User.exists({ _id: customer.user._id }), null);
    assert.equal(await Review.countDocuments({ user: customer.user._id }), 0);
    assert.equal(await Review.countDocuments({ user: other.user._id }), 1, 'other customers\' reviews stay');
    assert.equal((await Product.findById(product._id)).numReviews, 1, 'the rating is recounted');
    assert.equal(await ChatConversation.countDocuments({ user: customer.user._id }), 0, 'chat history is deleted');
    assert.equal((await Ticket.findById(ticket._id)).status, 'closed', 'tickets are kept but closed');
    assert.equal(await Order.countDocuments({ user: customer.user._id }), 1, 'orders are kept as records');
    assert.match(sentEmails.at(-1).subject, /account was deleted/);
    assert.equal((await api().get('/api/orders/myorders').set(customer.auth)).status, 401, 'the old session no longer works');
});

test('an account with an order on its way, or an admin account, cannot delete itself', async () => {
    const customer = await createUser({ password: 'pass-word-22' });
    const product = await createProduct();
    await placeOrder(customer, [line(product)]);
    const blocked = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-22' });
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /1 order on the way/);

    const admin = await createUser({ role: 'admin', password: 'admin-pass-33' });
    const adminRes = await api().delete('/api/auth/me').set(admin.auth).send({ password: 'admin-pass-33' });
    assert.equal(adminRes.status, 409);
});

test('admins promote and demote others, but never themselves or the last admin', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser();
    const unverified = await createUser({ verified: false });

    assert.equal((await api().put(`/api/auth/users/${admin.user._id}/role`).set(customer.auth).send({ role: 'admin' })).status, 403, 'customers cannot');
    const promoted = await api().put(`/api/auth/users/${customer.user._id}/role`).set(admin.auth).send({ role: 'admin' });
    assert.equal(promoted.status, 200);
    assert.equal((await User.findById(customer.user._id)).role, 'admin');
    assert.equal((await api().get('/api/analytics').set(customer.auth)).status, 200, 'the new admin can use the dashboard at once');

    assert.equal((await api().put(`/api/auth/users/${unverified.user._id}/role`).set(admin.auth).send({ role: 'admin' })).status, 409);
    assert.equal((await api().put(`/api/auth/users/${admin.user._id}/role`).set(admin.auth).send({ role: 'user' })).status, 409, 'not your own role');
    assert.equal((await api().put(`/api/auth/users/${customer.user._id}/role`).set(admin.auth).send({ role: 'owner' })).status, 400);

    const demoted = await api().put(`/api/auth/users/${customer.user._id}/role`).set(admin.auth).send({ role: 'user' });
    assert.equal(demoted.status, 200);
    assert.equal((await api().get('/api/analytics').set(customer.auth)).status, 403, 'access ends at once');

    // Two admins demoting each other at the same moment: the second change finds no admin left
    // and is undone. Simulated by having the admin count see none.
    const other = await createUser({ role: 'admin' });
    const realCount = User.countDocuments;
    User.countDocuments = function countWithNoAdmins(filter, ...rest) {
        return filter?.role === 'admin' ? Promise.resolve(0) : realCount.call(this, filter, ...rest);
    };
    try {
        const last = await api().put(`/api/auth/users/${other.user._id}/role`).set(admin.auth).send({ role: 'user' });
        assert.equal(last.status, 409);
        assert.match(last.body.message, /at least one admin/);
    } finally {
        User.countDocuments = realCount;
    }
    assert.equal((await User.findById(other.user._id)).role, 'admin', 'the change was undone');
});

test('deleting a customer switches off coupons meant only for them', async () => {
    const customer = await createUser({ password: 'pass-word-44' });
    const friend = await createUser();
    const personal = await Coupon.create({ code: 'PRIYA50', discountType: 'fixed', discountValue: 50, applicableUsers: [customer.user._id] });
    const shared = await Coupon.create({ code: 'DUO20', discountType: 'fixed', discountValue: 20, applicableUsers: [customer.user._id, friend.user._id] });

    assert.equal((await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-44' })).status, 200);
    const personalNow = await Coupon.findById(personal._id);
    assert.equal(personalNow.isActive, false, 'not open to everyone');
    assert.equal(personalNow.showToCustomers, false);
    const sharedNow = await Coupon.findById(shared._id);
    assert.equal(sharedNow.isActive, true);
    assert.deepEqual(sharedNow.applicableUsers.map(String), [String(friend.user._id)]);
});

test('an account can\'t be deleted while money is still on its way to or from it', async () => {
    const customer = await createUser({ password: 'pass-word-55' });
    const product = await createProduct();
    const order = await placeOrder(customer, [line(product)]);
    razorpay.failRefunds = true;
    await api().post(`/api/orders/${order._id}/cancel`).set(customer.auth);
    const owed = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-55' });
    assert.equal(owed.status, 409);
    assert.match(owed.body.message, /refund/);
    await Order.updateOne({ _id: order._id }, { $set: { 'refund.status': 'refunded' } });

    // Paid, but Razorpay is still confirming the payment, so the order doesn't exist yet.
    const checkout = await api().post('/api/payment/order').set(customer.auth).send({ items: [line(product)], address });
    await PaymentIntent.updateOne({ razorpayOrderId: checkout.body.razorpayOrderId }, { $set: { paymentId: 'pay_confirming' } });
    const confirming = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-55' });
    assert.equal(confirming.status, 409);
    assert.match(confirming.body.message, /still being confirmed/);
});

test('a checkout refund stuck for over a day no longer blocks deleting the account', async () => {
    const customer = await createUser({ password: 'pass-word-77' });
    const product = await createProduct();
    const checkout = await api().post('/api/payment/order').set(customer.auth).send({ items: [line(product)], address });
    const stuck = { razorpayOrderId: checkout.body.razorpayOrderId };
    await PaymentIntent.updateOne(stuck, { $set: { status: 'refund_pending', paymentId: 'pay_stuck' } });
    const recent = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-77' });
    assert.equal(recent.status, 409, 'a refund in progress blocks it');

    // Two days later it is still stuck (e.g. the server restarted mid-refund).
    await PaymentIntent.updateOne(stuck, { $set: { updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }, { timestamps: false });
    const later = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-77' });
    assert.equal(later.status, 200);
});

test('admins deleting a customer get the same checks', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser();
    const order = await placeOrder(customer, [line(await createProduct())]);

    const onTheWay = await api().delete(`/api/auth/users/${customer.user._id}`).set(admin.auth);
    assert.equal(onTheWay.status, 409);
    assert.match(onTheWay.body.message, /1 order on the way/);

    razorpay.failRefunds = true;
    await api().post(`/api/orders/${order._id}/cancel`).set(admin.auth);
    const owed = await api().delete(`/api/auth/users/${customer.user._id}`).set(admin.auth);
    assert.equal(owed.status, 409);
    assert.match(owed.body.message, /refund/);

    await Order.updateOne({ _id: order._id }, { $set: { 'refund.status': 'refunded' } });
    assert.equal((await api().delete(`/api/auth/users/${customer.user._id}`).set(admin.auth)).status, 200);
    assert.equal(await User.exists({ _id: customer.user._id }), null);
});

test('a payment that completes after the account was deleted is refunded, not turned into an order', async () => {
    const customer = await createUser({ password: 'pass-word-66' });
    const product = await createProduct({ stock: 3 });
    const checkout = await api().post('/api/payment/order').set(customer.auth).send({ items: [line(product)], address });
    // Paid in the Razorpay window, but the tab was closed before the shop heard about it.
    const { razorpay_payment_id: paymentId } = razorpay.pay(checkout.body.razorpayOrderId);
    assert.equal((await api().delete('/api/auth/me').set(customer.auth).send({ password: 'pass-word-66' })).status, 200);

    const { body, signature } = razorpay.capturedWebhook(paymentId);
    const webhook = await api().post('/api/payment/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(body);
    assert.equal(webhook.status, 200);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await PaymentIntent.findOne({ razorpayOrderId: checkout.body.razorpayOrderId })).status, 'refunded');
    assert.equal(razorpay.refunds.length, 1);
    assert.equal((await Product.findById(product._id)).stock, 3, 'no stock was taken');
});

test('the admin user list counts only money that was not refunded', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser();
    const product = await createProduct({ price: 600 });
    await placeOrder(customer, [line(product)]);
    const cancelled = await placeOrder(customer, [line(product)]);
    await api().post(`/api/orders/${cancelled._id}/cancel`).set(customer.auth);
    const users = await api().get('/api/auth/users').set(admin.auth);
    const row = users.body.find((user) => user.email === customer.user.email);
    assert.equal(row.orderCount, 2);
    assert.equal(row.totalSpent, 600);
});
