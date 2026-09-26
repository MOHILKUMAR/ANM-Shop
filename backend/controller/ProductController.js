const mongoose = require('mongoose');
const Product = require('../model/Product');
const cloudinary = require('../config/cloudinary');
const beautyCategories = require('../constants/beautyCategories');
const beautyCategorySet = new Set(beautyCategories);

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
        if (field === 'category' && !beautyCategorySet.has(normalized)) {
            return { error: `category must be one of: ${beautyCategories.join(', ')}` };
        }
        result[field] = normalized;
    }

    if (!partial && fields.some((field) => result[field] === undefined)) {
        return { error: 'Name, description, price, category, and stock are required' };
    }
    return { data: result };
};

const uploadProductImage = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', folder: 'anm-shop/products' },
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

    if (category && !beautyCategorySet.has(category)) {
        return res.status(400).json({ message: 'Choose a beauty category' });
    }

    const filter = { category: category || { $in: beautyCategories } };
    if (search) {
        const safeSearch = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ name: safeSearch }, { description: safeSearch }];
    }

    try {
        const [items, total, categories] = await Promise.all([
            Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Product.countDocuments(filter),
            Promise.resolve(beautyCategories),
        ]);
        return res.json({
            items,
            categories: categories.sort((left, right) => left.localeCompare(right)),
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
        const product = await Product.findById(req.params.id);
        if (!product || !beautyCategorySet.has(product.category)) {
            return res.status(404).json({ message: 'Beauty product not found' });
        }
        return res.json(product);
    } catch (error) {
        console.error('Fetch product error:', error.message);
        return res.status(500).json({ message: 'Unable to fetch product' });
    }
};

const createProductReview = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    const rating = Number(req.body.rating);
    const sentiment = typeof req.body.sentiment === 'string'
        ? req.body.sentiment.trim().toLowerCase()
        : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Choose a rating from 1 to 5' });
    }
    if (!['good', 'average', 'bad'].includes(sentiment)) {
        return res.status(400).json({ message: 'Choose Good, Average, or Bad' });
    }

    try {
        const product = await Product.findById(req.params.id);
        if (!product || !beautyCategorySet.has(product.category)) {
            return res.status(404).json({ message: 'Beauty product not found' });
        }

        const existingReview = product.reviews.find((review) => review.user.equals(req.user._id));
        if (existingReview) {
            existingReview.rating = rating;
            existingReview.sentiment = sentiment;
            existingReview.name = req.user.name;
        } else {
            product.reviews.push({
                user: req.user._id,
                name: req.user.name,
                rating,
                sentiment,
            });
        }

        product.numReviews = product.reviews.length;
        product.rating = product.numReviews
            ? Number((product.reviews.reduce((total, review) => total + review.rating, 0) / product.numReviews).toFixed(1))
            : 0;
        await product.save();
        return res.status(existingReview ? 200 : 201).json(product);
    } catch (error) {
        console.error('Create product review error:', error.message);
        return res.status(500).json({ message: 'Unable to save your review' });
    }
};

const getAdminProducts = async (req, res) => {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGE_SIZE_MAX);
    if (page < 1) return res.status(400).json({ message: 'Invalid page number' });

    try {
        const [items, total] = await Promise.all([
            Product.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Product.countDocuments({}),
        ]);
        return res.json({
            items,
            categories: beautyCategories,
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
        return res.json({ message: 'Product removed' });
    } catch (error) {
        console.error('Delete product error:', error.message);
        return res.status(500).json({ message: 'Unable to remove product' });
    }
};

module.exports = { deleteProduct, getProducts, getAdminProducts, getProductById, createProductReview, updateProduct, createProduct };
