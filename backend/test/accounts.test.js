const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, sentEmails } = require('./helpers');
const User = require('../model/User');
const Review = require('../model/Review');
const Order = require('../model/Order');
const Product = require('../model/Product');

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
    sentEmails.length = 0;

    assert.equal((await api().delete('/api/auth/me').set(customer.auth).send({ password: 'wrong' })).status, 400);
    const res = await api().delete('/api/auth/me').set(customer.auth).send({ password: 'correct-horse-1' });
    assert.equal(res.status, 200);
    assert.equal(await User.exists({ _id: customer.user._id }), null);
    assert.equal(await Review.countDocuments(), 0);
    assert.equal((await Product.findById(product._id)).numReviews, 0, 'the rating is recounted');
    assert.equal(await Order.countDocuments(), 1, 'orders are kept as records');
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
