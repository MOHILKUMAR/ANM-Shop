// Render runs the API in UTC. Pin this test process to UTC too, so a time formatted in the
// server's own zone shows up here (on a computer set to India time it would look right).
process.env.TZ = 'UTC';

const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, sentEmails } = require('./helpers');
const Order = require('../model/Order');
const User = require('../model/User');

before(startDb);
after(stopDb);
beforeEach(resetDb);

// Waits up to 2 s for an email sent in the background.
const eventually = async (find) => {
    for (let tries = 0; tries < 40 && !find(); tries += 1) await new Promise((resolve) => { setTimeout(resolve, 50); });
    return find();
};

test('the e-bill shows the order time in India time', async () => {
    const customer = await createUser();
    const product = await createProduct();
    const order = await placeOrder(customer, [{ productId: String(product._id), qty: 1 }]);
    // 8 pm UTC on 15 January is 1:30 am on the 16th in India. (Straight to the collection:
    // Mongoose doesn't let an update change createdAt.)
    await Order.collection.updateOne({ _id: new Types.ObjectId(String(order._id)) }, { $set: { createdAt: new Date('2026-01-15T20:00:00Z') } });

    sentEmails.length = 0;
    const resent = await api().post(`/api/orders/${order._id}/resend-invoice`).set(customer.auth);
    assert.equal(resent.status, 200);
    const bill = sentEmails.find((email) => email.subject.includes('e-bill'));
    assert.ok(bill, 'the e-bill was sent');
    assert.ok(bill.text.includes('Date: 16 Jan 2026, 1:30 am'), bill.text);
    assert.ok(bill.html.includes('>16 Jan 2026, 1:30 am<'), 'the HTML shows the same date');
});

test('the password-changed email shows the time in India time', async () => {
    const customer = await createUser({ password: 'old-password-1' });
    const changed = await api().put('/api/auth/password').set(customer.auth)
        .send({ currentPassword: 'old-password-1', newPassword: 'new-password-2' });
    assert.equal(changed.status, 200);

    const notice = await eventually(() => sentEmails.find((email) => email.subject.includes('password was changed')));
    assert.ok(notice, 'the notice was sent');
    // India is UTC+5:30 all year. The month is left to the locale (it writes September "Sept").
    const { passwordChangedAt } = await User.findById(customer.user._id);
    const ist = new Date(passwordChangedAt.getTime() + 330 * 60 * 1000);
    const hours = ist.getUTCHours();
    const clock = `${hours % 12 || 12}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
    const expected = new RegExp(`was changed on ${ist.getUTCDate()} [A-Z][a-z]+ ${ist.getUTCFullYear()}, ${clock} \\(India time\\)\\.`);
    assert.match(notice.text, expected);
});
