// Render runs the API in UTC. Pin this test process to UTC too, so a time formatted in the
// server's own zone shows up here (on a computer set to India time it would look right).
process.env.TZ = 'UTC';

const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct, placeOrder, sentEmails } = require('./helpers');
const User = require('../model/User');

before(startDb);
after(stopDb);
beforeEach(resetDb);

// Waits up to 2 s for an email sent in the background.
const eventually = async (find) => {
    for (let tries = 0; tries < 40 && !find(); tries += 1) await new Promise((resolve) => { setTimeout(resolve, 50); });
    return find();
};

// India time (UTC+5:30, no daylight saving), worked out by hand: e.g. "16 Jan 2026, 1:30 am".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const indiaTime = (date) => {
    const ist = new Date(new Date(date).getTime() + 330 * 60 * 1000);
    const hours = ist.getUTCHours();
    return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}, ${hours % 12 || 12}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
};

test('the e-bill shows the order time in India time', async () => {
    const customer = await createUser();
    const product = await createProduct();
    const order = await placeOrder(customer, [{ productId: String(product._id), qty: 1 }]);

    const bill = await eventually(() => sentEmails.find((email) => email.subject.includes('e-bill')));
    assert.ok(bill, 'the e-bill was sent');
    const expected = indiaTime(order.createdAt);
    assert.ok(bill.text.includes(`Date: ${expected}`), `text should say "Date: ${expected}":\n${bill.text}`);
    assert.ok(bill.html.includes(`>${expected}<`), `the HTML should show ${expected}`);
});

test('the password-changed email shows the time in India time', async () => {
    const customer = await createUser({ password: 'old-password-1' });
    const changed = await api().put('/api/auth/password').set(customer.auth)
        .send({ currentPassword: 'old-password-1', newPassword: 'new-password-2' });
    assert.equal(changed.status, 200);

    const notice = await eventually(() => sentEmails.find((email) => email.subject.includes('password was changed')));
    assert.ok(notice, 'the notice was sent');
    const { passwordChangedAt } = await User.findById(customer.user._id);
    const expected = indiaTime(passwordChangedAt);
    assert.ok(notice.text.includes(`was changed on ${expected} (India time).`), `text should give ${expected}:\n${notice.text}`);
});
