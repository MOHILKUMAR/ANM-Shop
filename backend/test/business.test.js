const { before, after, beforeEach, afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { startDb, stopDb, resetDb, createUser, createProduct, placeOrder, sentEmails } = require('./helpers');
const { business } = require('../config/business');

before(startDb);
after(stopDb);
beforeEach(resetDb);

// Each test starts from empty details, whatever config/business.js holds.
const shipped = { ...business };
beforeEach(() => { Object.assign(business, { legalName: '', address: '', phone: '', gstin: '' }); });
afterEach(() => { Object.assign(business, shipped); });

const eBillFor = async () => {
    const customer = await createUser();
    const product = await createProduct();
    await placeOrder(customer, [{ productId: String(product._id), qty: 1 }]);
    const bill = sentEmails.find((email) => email.subject.includes('e-bill'));
    assert.ok(bill, 'the e-bill was sent');
    return bill;
};

test("the API's business details match the site's (frontend/src/data/contactInfo.js)", async () => {
    const site = await import(pathToFileURL(path.join(__dirname, '../../frontend/src/data/contactInfo.js')).href);
    assert.deepEqual(shipped, { ...site.business }, 'backend/config/business.js and frontend/src/data/contactInfo.js must hold the same business details');
});

// The PDF bill's font (helvetica) draws Latin-1 and common punctuation; anything else garbles the line.
test('the business details use only characters the PDF bill can print', () => {
    for (const [field, value] of Object.entries(shipped)) {
        assert.match(value, /^[\x20-\x7E\xA0-\xFF–—‘’“”]*$/, `${field} has a character the PDF bill can't print (e.g. ₹, № or Hindi): ${value}`);
    }
});

test('the e-bill names no seller while the details are empty', async () => {
    Object.assign(business, { legalName: 'Example Beauty Traders' }); // no address yet
    const bill = await eBillFor();
    assert.ok(!bill.text.includes('Sold by'), bill.text);
    assert.ok(!bill.html.includes('Sold by'));
});

test('once filled in, the e-bill names the seller, its GSTIN and phone', async () => {
    Object.assign(business, { legalName: ' Example & Sons Beauty ', address: '12 Sample Road, Delhi, Delhi 110001 ', phone: '+91 90000 00000', gstin: 'GSTIN-SAMPLE-0001' });
    const bill = await eBillFor();

    const lines = bill.text.split('\n');
    assert.deepEqual(lines.slice(1, 4), [
        'Sold by: Example & Sons Beauty, 12 Sample Road, Delhi, Delhi 110001',
        'GSTIN: GSTIN-SAMPLE-0001',
        'Phone: +91 90000 00000',
    ]);
    assert.ok(bill.html.includes('Sold by <strong style="color:#33252e">Example &amp; Sons Beauty</strong>, 12 Sample Road, Delhi, Delhi 110001<br>GSTIN: GSTIN-SAMPLE-0001<br>Phone: +91 90000 00000</p>'), 'the HTML names the seller, escaped');
});

test('a seller without GSTIN or phone gets just the name and address', async () => {
    Object.assign(business, { legalName: 'Example Beauty Traders', address: '12 Sample Road, Delhi, Delhi 110001' });
    const bill = await eBillFor();
    assert.ok(bill.text.includes('Sold by: Example Beauty Traders, 12 Sample Road, Delhi, Delhi 110001\nOrder: '), bill.text);
    assert.ok(!bill.text.includes('GSTIN'));
    assert.ok(bill.html.includes('Delhi 110001</p>'));
});
