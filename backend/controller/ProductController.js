const mongoose = require('mongoose');
const Product = require('../model/Product');
const Review = require('../model/Review');
const cloudinary = require('../config/cloudinary');
const { categoryNames } = require('../utils/categories');

const MAX_PRICE = 100000000;
const MAX_STOCK = 1000000;
const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 100;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseProductFields = (body, partial = false) => {
    const fields = ['name', 'description', 'price', 'category', 'stock'];
    const result = {};

    for (const field of fields) {
        if (partial && body[field] === undefined) continue;
        const value = body[field];
        if (field === 'price' || field === 'stock') {
            if (value === '' || value === null || value === undefined) {
                return { error: `${field} is required` };
            }
            const number = Number(value);
            if (!Number.isFinite(number)) return { error: `${field} must be a valid number` };
            if (field === 'price' && (number < 0.01 || number > MAX_PRICE)) {
                return { error: `price must be between 0.01 and ${MAX_PRICE}` };
            }
            if (field === 'stock' && (!Number.isInteger(number) || number < 0 || number > MAX_STOCK)) {
                return { error: `stock must be a whole number between 0 and ${MAX_STOCK}` };
            }
            result[field] = number;
            continue;
        }

        if (typeof value !== 'string') return { error: `${field} must be text` };
        const normalized = value.trim();
        const maxLength = field === 'description' ? 5000 : field === 'name' ? 120 : 80;
        if (!normalized || normalized.length > maxLength) {
            return { error: `${field} is required and must be at most ${maxLength} characters` };
        }
        result[field] = normalized;
    }

    if (!partial && fields.some((field) => result[field] === undefined)) {
        return { error: 'Name, description, price, category, and stock are required' };
    }
    return { data: result };
};

// The category must be one of the shop's categories (managed by admins).
const checkCategory = async (data) => {
    if (data.category === undefined) return null;
    const names = await categoryNames();
    return names.includes(data.category) ? null : `category must be one of: ${names.join(', ')}`;
};

const uploadProductImage = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        {
            resource_type: 'image',
            folder: 'anm-shop/products',
            // Stored at most 1600px on the longest side; the storefront asks for smaller sizes.
            transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
        },
        (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url) return reject(new Error('Image provider returned no secure URL'));
            return resolve(result.secure_url);
        },
    );
    stream.end(file.buffer);
});

const getProducts = async (req, res) => {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGE_SIZE_MAX);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    if (page < 1 || search.length > 100 || category.length > 80) {
        return res.status(400).json({ message: 'Invalid product-list filters' });
    }

    try {
        const categories = await categoryNames();
        if (category && !categories.includes(category)) {
            return res.status(400).json({ message: 'Choose one of the shop’s categories' });
        }

        const filter = { category: category || { $in: categories } };
        if (search) {
            const safeSearch = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ name: safeSearch }, { description: safeSearch }];
        }

        const [items, total] = await Promise.all([
            Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Product.countDocuments(filter),
        ]);
        return res.json({
            items,
            // In the order admins set in the Categories tab.
            categories,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Fetch products error:', error.message);
        return res.status(500).json({ message: 'Unable to fetch products' });
    }
};

const getProductById = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    try {
        const [product, categories] = await Promise.all([Product.findById(req.params.id), categoryNames()]);
        if (!product || !categories.includes(product.category)) {
            return res.status(404).json({ message: 'Beauty product not found' });
        }
        return res.json(product);
    } catch (error) {
        console.error('Fetch product error:', error.message);
        return res.status(500).json({ message: 'Unable to fetch product' });
    }
};

// GET /api/products/lookup?ids=a,b,c — current price and stock for the products in a cart.
// Products that are missing from `items` are no longer sold.
const lookupProducts = async (req, res) => {
    const ids = typeof req.query.ids === 'string' ? [...new Set(req.query.ids.split(',').map((id) => id.trim()).filter(Boolean))] : [];
    if (!ids.length || ids.length > 50 || ids.some((id) => !mongoose.isValidObjectId(id))) {
        return res.status(400).json({ message: 'Send up to 50 product IDs' });
    }
    try {
        const items = await Product.find({ _id: { $in: ids }, category: { $in: await categoryNames() } })
            .select('name price stock category imageUrls').lean();
        return res.json({ items });
    } catch (error) {
        console.error('Product lookup error:', error.message);
        return res.status(500).json({ message: 'Unable to check your cart' });
    }
};

const getAdminProducts = async (req, res) => {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGE_SIZE_MAX);
    if (page < 1) return res.status(400).json({ message: 'Invalid page number' });

    try {
        const [items, total, categories] = await Promise.all([
            Product.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Product.countDocuments({}),
            categoryNames(),
        ]);
        return res.json({
            items,
            categories,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Fetch admin products error:', error.message);
        return res.status(500).json({ message: 'Unable to fetch catalog products' });
    }
};

const createProduct = async (req, res) => {
    const { data, error } = parseProductFields(req.body);
    if (error) return res.status(400).json({ message: error });
    const categoryError = await checkCategory(data);
    if (categoryError) return res.status(400).json({ message: categoryError });
    if (!req.file) return res.status(400).json({ message: 'A JPEG, PNG, or WebP image is required' });

    try {
        data.imageUrls = await uploadProductImage(req.file);
        const product = await Product.create(data);
        return res.status(201).json(product);
    } catch (createError) {
        console.error('Create product error:', createError.message);
        return res.status(500).json({ message: 'Unable to create product' });
    }
};

const updateProduct = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }
    const { data, error } = parseProductFields(req.body, true);
    if (error) return res.status(400).json({ message: error });
    const categoryError = await checkCategory(data);
    if (categoryError) return res.status(400).json({ message: categoryError });
    if (Object.keys(data).length === 0 && !req.file) {
        return res.status(400).json({ message: 'Provide at least one field or a replacement image' });
    }

    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (req.file) data.imageUrls = await uploadProductImage(req.file);
        Object.assign(product, data);
        await product.save();
        return res.json(product);
    } catch (updateError) {
        console.error('Update product error:', updateError.message);
        return res.status(500).json({ message: 'Unable to update product' });
    }
};

const deleteProduct = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        await Review.deleteMany({ product: product._id });
        return res.json({ message: 'Product removed' });
    } catch (error) {
        console.error('Delete product error:', error.message);
        return res.status(500).json({ message: 'Unable to remove product' });
    }
};

module.exports = { deleteProduct, getProducts, getAdminProducts, getProductById, lookupProducts, updateProduct, createProduct };
