const mongoose = require('mongoose');
const Category = require('../model/Category');
const Product = require('../model/Product');
const Coupon = require('../model/Coupon');
const { listCategories, clearCategoryCache } = require('../utils/categories');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The fields an admin may set, or the problem with them.
const parseCategory = (body) => {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 2 || name.length > 60) return { error: 'The name must be 2 to 60 characters' };
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length > 200) return { error: 'The description must be at most 200 characters' };
    const icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : '✦';
    if ([...icon].length > 2) return { error: 'The icon must be one or two characters, e.g. ✦' };
    const sortOrder = body.sortOrder === undefined || body.sortOrder === '' ? undefined : Number(body.sortOrder);
    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999)) {
        return { error: 'The position must be a whole number from 0 to 999' };
    }
    return { data: { name, description, icon, ...(sortOrder !== undefined ? { sortOrder } : {}) } };
};

// Another category already using this name, ignoring upper / lower case.
const nameTaken = (name, exceptId) => Category.exists({
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
});

// GET /api/categories — the categories on sale, in display order (public).
const getCategories = async (req, res) => {
    try {
        return res.json(await listCategories());
    } catch (error) {
        console.error('List categories error:', error.message);
        return res.status(500).json({ message: 'Unable to load categories' });
    }
};

// GET /api/categories/manage — every category with how many products and coupons use it.
const getCategoriesForAdmin = async (req, res) => {
    try {
        const [categories, productCounts, couponCounts] = await Promise.all([
            Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
            Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
            Coupon.aggregate([{ $unwind: '$applicableCategories' }, { $group: { _id: '$applicableCategories', count: { $sum: 1 } } }]),
        ]);
        const products = new Map(productCounts.map((row) => [row._id, row.count]));
        const coupons = new Map(couponCounts.map((row) => [row._id, row.count]));
        return res.json(categories.map((category) => ({
            ...category,
            productCount: products.get(category.name) || 0,
            couponCount: coupons.get(category.name) || 0,
        })));
    } catch (error) {
        console.error('Admin categories error:', error.message);
        return res.status(500).json({ message: 'Unable to load categories' });
    }
};

const createCategory = async (req, res) => {
    const { data, error } = parseCategory(req.body);
    if (error) return res.status(400).json({ message: error });
    try {
        if (await nameTaken(data.name)) return res.status(409).json({ message: `A category called “${data.name}” already exists` });
        if (data.sortOrder === undefined) {
            const last = await Category.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
            data.sortOrder = Math.min((last?.sortOrder ?? -1) + 1, 999);
        }
        const category = await Category.create(data);
        clearCategoryCache();
        return res.status(201).json(category);
    } catch (createError) {
        if (createError.code === 11000) return res.status(409).json({ message: `A category called “${data.name}” already exists` });
        console.error('Create category error:', createError.message);
        return res.status(500).json({ message: 'Unable to create the category' });
    }
};

// Renaming also renames the category on its products and in coupon restrictions, in one
// transaction, so nothing is left pointing at the old name.
const updateCategory = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid category ID' });
    const { data, error } = parseCategory(req.body);
    if (error) return res.status(400).json({ message: error });
    const session = await mongoose.startSession();
    try {
        let saved;
        await session.withTransaction(async () => {
            const category = await Category.findById(req.params.id).session(session);
            if (!category) throw Object.assign(new Error('Category not found'), { status: 404 });
            if (await nameTaken(data.name, category._id).session(session)) {
                throw Object.assign(new Error(`A category called “${data.name}” already exists`), { status: 409 });
            }
            const oldName = category.name;
            Object.assign(category, data);
            saved = await category.save({ session });
            if (oldName !== data.name) {
                await Product.updateMany({ category: oldName }, { $set: { category: data.name } }, { session });
                await Coupon.updateMany({ applicableCategories: oldName }, { $set: { 'applicableCategories.$': data.name } }, { session });
            }
        });
        clearCategoryCache();
        return res.json(saved);
    } catch (updateError) {
        if (updateError.status) return res.status(updateError.status).json({ message: updateError.message });
        if (updateError.code === 11000) return res.status(409).json({ message: `A category called “${data.name}” already exists` });
        console.error('Update category error:', updateError.message);
        return res.status(500).json({ message: 'Unable to update the category' });
    } finally {
        await session.endSession();
    }
};

// Refused while products or coupons use the category: deleting it would hide those products,
// and a coupon limited to it would suddenly apply to everything.
const deleteCategory = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid category ID' });
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found' });
        const [products, coupons] = await Promise.all([
            Product.countDocuments({ category: category.name }),
            Coupon.find({ applicableCategories: category.name }).select('code').limit(5).lean(),
        ]);
        if (products) {
            return res.status(409).json({ message: `${products} product${products === 1 ? '' : 's'} still use “${category.name}”. Move or delete them first.` });
        }
        if (coupons.length) {
            return res.status(409).json({ message: `Coupon${coupons.length === 1 ? '' : 's'} ${coupons.map((coupon) => coupon.code).join(', ')} still use “${category.name}”. Edit them first.` });
        }
        await category.deleteOne();
        clearCategoryCache();
        return res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error('Delete category error:', error.message);
        return res.status(500).json({ message: 'Unable to delete the category' });
    }
};

module.exports = { getCategories, getCategoriesForAdmin, createCategory, updateCategory, deleteCategory, parseCategory };
