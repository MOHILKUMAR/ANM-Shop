const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, resetDb, api, createUser, createProduct } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(resetDb);

const photo = Buffer.from('fake image bytes');
const withPhotos = (req, count) => {
    for (let index = 0; index < count; index += 1) req.attach('images', photo, { filename: `photo${index}.jpg`, contentType: 'image/jpeg' });
    return req;
};

test('search ranks name matches first and still finds half-typed words', async () => {
    await createProduct({ name: 'Daily cleanser', description: 'Gentle foam that pairs well with a vitamin c serum.' });
    await createProduct({ name: 'Vitamin C serum', description: 'Brightening serum for dull skin.' });
    await createProduct({ name: 'Rich moisturiser', description: 'Night cream.' });

    const serum = await api().get('/api/products').query({ search: 'vitamin serum' });
    assert.equal(serum.status, 200);
    assert.deepEqual(serum.body.items.map((product) => product.name), ['Vitamin C serum', 'Daily cleanser']);

    const partial = await api().get('/api/products').query({ search: 'moist' });
    assert.deepEqual(partial.body.items.map((product) => product.name), ['Rich moisturiser'], 'falls back to a substring match');

    const none = await api().get('/api/products').query({ search: 'shampoo' });
    assert.equal(none.body.pagination.total, 0);
});

test('search also finds the word inside longer words, after the whole-word matches', async () => {
    await createProduct({ name: 'Velvet Matte Lipstick', description: 'Rich colour that lasts.' });
    await createProduct({ name: 'Nourish Lip Balm', description: 'Softens dry lips.' });
    await createProduct({ name: 'Hair oil', description: 'Adds shine.' });

    const lip = await api().get('/api/products').query({ search: 'lip' });
    assert.deepEqual(lip.body.items.map((product) => product.name), ['Nourish Lip Balm', 'Velvet Matte Lipstick']);
    assert.equal(lip.body.pagination.total, 2);
    const secondPage = await api().get('/api/products').query({ search: 'lip', limit: 1, page: 2 });
    assert.deepEqual(secondPage.body.items.map((product) => product.name), ['Velvet Matte Lipstick'], 'pages run across both groups');
    assert.equal(secondPage.body.pagination.pages, 2);
});

test('an old link to a renamed category is reported as such', async () => {
    const res = await api().get('/api/products').query({ category: 'Hair Care (old)' });
    assert.equal(res.status, 400);
    assert.equal(res.body.unknownCategory, true, 'so the shop can show everything instead');
});

test('admins can search their product list', async () => {
    const admin = await createUser({ role: 'admin' });
    await createProduct({ name: 'Lip balm' });
    await createProduct({ name: 'Hair oil' });
    const res = await api().get('/api/products/manage').set(admin.auth).query({ search: 'balm' });
    assert.deepEqual(res.body.items.map((product) => product.name), ['Lip balm']);
});

test('a product can have up to 6 photos; the first is the main one', async () => {
    const admin = await createUser({ role: 'admin' });
    const fields = { name: 'Clay mask', description: 'Deep-cleansing mask.', price: '450', category: 'Skincare', stock: '12' };

    const noPhoto = await api().post('/api/products').set(admin.auth).field(fields);
    assert.equal(noPhoto.status, 400);

    const created = await withPhotos(api().post('/api/products').set(admin.auth).field(fields), 3);
    assert.equal(created.status, 201);
    assert.equal(created.body.images.length, 3);
    assert.equal(created.body.imageUrls, created.body.images[0]);

    const tooMany = await withPhotos(api().put(`/api/products/${created.body._id}`).set(admin.auth), 4);
    assert.equal(tooMany.status, 400, '3 kept + 4 new is more than 6');

    // Keep the 3rd and 1st photos (in that order) and add one more.
    const [first, , third] = created.body.images;
    const edited = await withPhotos(api().put(`/api/products/${created.body._id}`).set(admin.auth).field('keepImages', JSON.stringify([third, first])), 1);
    assert.equal(edited.status, 200);
    assert.equal(edited.body.images.length, 3);
    assert.deepEqual(edited.body.images.slice(0, 2), [third, first]);
    assert.equal(edited.body.imageUrls, third, 'the new first photo is the main one');

    const empty = await api().put(`/api/products/${created.body._id}`).set(admin.auth).field('keepImages', '[]');
    assert.equal(empty.status, 400, 'a product needs at least one photo');
});

test('products from before galleries keep working', async () => {
    const admin = await createUser({ role: 'admin' });
    const old = await createProduct({ imageUrls: 'https://res.cloudinary.com/demo/image/upload/old.jpg' });
    const added = await withPhotos(api().put(`/api/products/${old._id}`).set(admin.auth), 1);
    assert.equal(added.status, 200);
    assert.deepEqual(added.body.images, ['https://res.cloudinary.com/demo/image/upload/old.jpg', added.body.images[1]]);
});
