const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct, address } = require('./helpers');
const Order = require('../model/Order');
const Ticket = require('../model/Ticket');

before(startDb);
after(stopDb);
beforeEach(resetDb);

test('the admin order list is paged and filtered by status, with counts', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser();
    const product = await createProduct();
    const orders = Array.from({ length: 25 }, (_, index) => ({
        user: customer.user._id,
        items: [{ productId: product._id, qty: 1, price: 200 }],
        totalAmount: 249,
        address,
        status: index < 5 ? 'shipped' : 'pending',
        paymentId: `pay_test${index}`,
    }));
    await Order.insertMany(orders);

    const first = await api().get('/api/orders').set(admin.auth);
    assert.equal(first.status, 200);
    assert.equal(first.body.orders.length, 20);
    assert.deepEqual(first.body.pagination, { page: 1, limit: 20, total: 25, pages: 2 });
    assert.equal(first.body.counts.pending, 20);
    assert.equal(first.body.counts.shipped, 5);

    const second = await api().get('/api/orders').set(admin.auth).query({ page: 2 });
    assert.equal(second.body.orders.length, 5);

    const shipped = await api().get('/api/orders').set(admin.auth).query({ status: 'shipped' });
    assert.equal(shipped.body.pagination.total, 5);
    assert.ok(shipped.body.orders.every((order) => order.status === 'shipped'));

    assert.equal((await api().get('/api/orders').set(admin.auth).query({ status: 'lost' })).status, 400);
    assert.equal((await api().get('/api/orders').set(customer.auth)).status, 403);
});

test('admins can page through more than 200 tickets', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser();
    await Ticket.insertMany(Array.from({ length: 230 }, (_, index) => ({
        user: customer.user._id,
        subject: `Question ${index}`,
        category: 'other',
        description: 'Where is my parcel please?',
        lastActivityAt: new Date(Date.now() - index * 1000),
    })));

    const first = await api().get('/api/tickets').set(admin.auth);
    assert.equal(first.body.tickets.length, 50);
    assert.deepEqual(first.body.pagination, { page: 1, limit: 50, total: 230, pages: 5 });
    const last = await api().get('/api/tickets').set(admin.auth).query({ page: 5 });
    assert.equal(last.body.tickets.length, 30);
    assert.equal(last.body.tickets.at(-1).subject, 'Question 229', 'oldest activity last');
});
