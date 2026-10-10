const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct } = require('./helpers');
const Product = require('../model/Product');
const Coupon = require('../model/Coupon');

before(startDb);
after(stopDb);
beforeEach(resetDb);

test('the shop starts with the 7 default categories, in order', async () => {
    const res = await api().get('/api/categories');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((category) => category.name), [
        'Skincare', 'Face Makeup', 'Eye Makeup', 'Lip Makeup', 'Haircare', 'Body & Personal Care', 'Tools & Accessories',
    ]);
});

test('only admins can add categories, and names are unique ignoring case', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    assert.equal((await api().post('/api/categories').set(customer.auth).send({ name: 'Fragrance' })).status, 403);

    const created = await api().post('/api/categories').set(admin.auth).send({ name: 'Fragrance', description: 'Perfumes and mists', icon: '❀' });
    assert.equal(created.status, 201);
    assert.equal(created.body.sortOrder, 7, 'added at the end');
    assert.equal((await api().post('/api/categories').set(admin.auth).send({ name: 'fragrance' })).status, 409);
    assert.equal((await api().post('/api/categories').set(admin.auth).send({ name: 'x' })).status, 400);

    await createProduct({ name: 'Rose mist', category: 'Fragrance' });
    const shop = await api().get('/api/products').query({ category: 'Fragrance' });
    assert.equal(shop.status, 200);
    assert.deepEqual(shop.body.items.map((product) => product.name), ['Rose mist']);
    assert.ok(shop.body.categories.includes('Fragrance'));
});

test('renaming a category renames it on products and coupons', async () => {
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct({ category: 'Haircare' });
    await Coupon.create({ code: 'HAIR10', discountType: 'percentage', discountValue: 10, applicableCategories: ['Haircare', 'Skincare'] });
    const haircare = (await api().get('/api/categories').then((res) => res.body)).find((category) => category.name === 'Haircare');

    const res = await api().put(`/api/categories/${haircare._id}`).set(admin.auth).send({ name: 'Hair Care', description: 'Shampoo and more', icon: '〰' });
    assert.equal(res.status, 200);
    assert.equal((await Product.findById(product._id)).category, 'Hair Care');
    assert.deepEqual((await Coupon.findOne({ code: 'HAIR10' })).applicableCategories, ['Hair Care', 'Skincare']);
    assert.equal((await api().get('/api/products').query({ category: 'Haircare' })).status, 400, 'the old name is gone');
    assert.equal((await api().get(`/api/products/${product._id}`)).status, 200);
});

test('a category in use cannot be deleted; an unused one can', async () => {
    const admin = await createUser({ role: 'admin' });
    const list = (await api().get('/api/categories')).body;
    const id = (name) => list.find((category) => category.name === name)._id;

    await createProduct({ category: 'Eye Makeup' });
    const withProducts = await api().delete(`/api/categories/${id('Eye Makeup')}`).set(admin.auth);
    assert.equal(withProducts.status, 409);
    assert.match(withProducts.body.message, /1 product/);

    await Coupon.create({ code: 'LIPS', discountType: 'fixed', discountValue: 50, applicableCategories: ['Lip Makeup'] });
    const withCoupon = await api().delete(`/api/categories/${id('Lip Makeup')}`).set(admin.auth);
    assert.equal(withCoupon.status, 409);
    assert.match(withCoupon.body.message, /LIPS/);

    assert.equal((await api().delete(`/api/categories/${id('Tools & Accessories')}`).set(admin.auth)).status, 200);
    assert.ok(!(await api().get('/api/categories')).body.some((category) => category.name === 'Tools & Accessories'));
});

test('products outside the shop\'s categories are hidden and cannot be bought', async () => {
    const customer = await createUser();
    const legacy = await createProduct({ name: 'Gaming Keyboard', category: 'Electronics' });
    const listed = await api().get('/api/products');
    assert.ok(!listed.body.items.some((product) => product.name === 'Gaming Keyboard'));
    assert.equal((await api().get(`/api/products/${legacy._id}`)).status, 404);
    const quote = await api().post('/api/payment/quote').set(customer.auth).send({ items: [{ productId: legacy._id, qty: 1 }] });
    assert.equal(quote.status, 409);
});

test('admin product form rejects an unknown category', async () => {
    const admin = await createUser({ role: 'admin' });
    const product = await createProduct();
    const res = await api().put(`/api/products/${product._id}`).set(admin.auth).send({ category: 'Nope' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /category must be one of/);
});
