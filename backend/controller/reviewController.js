const mongoose = require('mongoose');
const Product = require('../model/Product');
const Review = require('../model/Review');
const Order = require('../model/Order');
const { categoryNames } = require('../utils/categories');
const { publicName, refreshProductRating } = require('../utils/reviews');

const { RATINGS } = Review;
const COMMENT_MIN = 10;
const COMMENT_MAX = 1000;
const PUBLIC_FIELDS = 'name rating comment verifiedBuyer createdAt updatedAt';

const pageParams = (query, defaultLimit, maxLimit) => {
    const page = Number.parseInt(query.page, 10) || 1;
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
    return page >= 1 ? { page, limit } : null;
};

const findShopProduct = async (id) => (mongoose.isValidObjectId(id)
    ? Product.findOne({ _id: id, category: { $in: await categoryNames() } }).select('numReviews ratingCounts')
    : null);

const summaryOf = (product) => ({
    total: product.numReviews || 0,
    counts: {
        bad: product.ratingCounts?.bad || 0,
        good: product.ratingCounts?.good || 0,
        excellent: product.ratingCounts?.excellent || 0,
    },
});

// The customer's own review, including whether an admin has hidden it.
const ownView = (review) => review && {
    _id: review._id,
    name: review.name,
    rating: review.rating,
    comment: review.comment,
    verifiedBuyer: review.verifiedBuyer,
    hidden: review.hidden,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
};

// GET /api/products/:id/reviews — visible reviews, newest first, for everyone.
const listProductReviews = async (req, res) => {
    const paging = pageParams(req.query, 10, 50);
    if (!paging) return res.status(400).json({ message: 'Invalid page number' });
    try {
        const product = await findShopProduct(req.params.id);
        if (!product) return res.status(404).json({ message: 'Beauty product not found' });
        const filter = { product: product._id, hidden: false };
        const [reviews, total] = await Promise.all([
            Review.find(filter).sort({ createdAt: -1, _id: -1 })
                .skip((paging.page - 1) * paging.limit).limit(paging.limit)
                .select(PUBLIC_FIELDS).lean(),
            Review.countDocuments(filter),
        ]);
        return res.json({
            summary: summaryOf(product),
            reviews,
            pagination: { ...paging, total, pages: Math.ceil(total / paging.limit) },
        });
    } catch (error) {
        console.error('List reviews error:', error.message);
        return res.status(500).json({ message: 'Unable to load reviews' });
    }
};

// GET /api/products/:id/reviews/mine
const myProductReview = async (req, res) => {
    try {
        const product = await findShopProduct(req.params.id);
        if (!product) return res.status(404).json({ message: 'Beauty product not found' });
        const review = await Review.findOne({ product: product._id, user: req.user._id }).lean();
        return res.json({ review: ownView(review) || null });
    } catch (error) {
        console.error('Load own review error:', error.message);
        return res.status(500).json({ message: 'Unable to load your review' });
    }
};

// POST /api/products/:id/reviews — writes the customer's review, or edits it if they have one.
const saveProductReview = async (req, res) => {
    const rating = typeof req.body?.rating === 'string' ? req.body.rating.trim().toLowerCase() : '';
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    if (!RATINGS.includes(rating)) {
        return res.status(400).json({ message: 'Choose Bad, Good, or Excellent' });
    }
    if (comment.length < COMMENT_MIN || comment.length > COMMENT_MAX) {
        return res.status(400).json({ message: `Write a review of ${COMMENT_MIN} to ${COMMENT_MAX} characters` });
    }

    try {
        const product = await findShopProduct(req.params.id);
        if (!product) return res.status(404).json({ message: 'Beauty product not found' });

        // Every order is created after its payment succeeds, so any order counts as a purchase.
        const verifiedBuyer = Boolean(await Order.exists({ user: req.user._id, 'items.productId': product._id, status: { $ne: 'cancelled' } }));
        const result = await Review.findOneAndUpdate(
            { product: product._id, user: req.user._id },
            { $set: { name: publicName(req.user.name), rating, comment, verifiedBuyer } },
            { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true },
        );
        const created = !result.lastErrorObject?.updatedExisting;
        const summary = await refreshProductRating(product._id);
        const review = result.value;
        return res.status(created ? 201 : 200).json({
            message: review.hidden
                ? 'Your review was updated. It is still hidden by the shop.'
                : created ? 'Thanks! Your review is now live.' : 'Your review was updated.',
            review: ownView(review),
            summary,
        });
    } catch (error) {
        console.error('Save review error:', error.message);
        return res.status(500).json({ message: 'Unable to save your review' });
    }
};

// DELETE /api/products/:id/reviews/mine
const deleteMyReview = async (req, res) => {
    try {
        const product = await findShopProduct(req.params.id);
        if (!product) return res.status(404).json({ message: 'Beauty product not found' });
        const deleted = await Review.findOneAndDelete({ product: product._id, user: req.user._id });
        if (!deleted) return res.status(404).json({ message: 'You have not reviewed this product' });
        const summary = await refreshProductRating(product._id);
        return res.json({ message: 'Your review was deleted.', summary });
    } catch (error) {
        console.error('Delete review error:', error.message);
        return res.status(500).json({ message: 'Unable to delete your review' });
    }
};

// GET /api/reviews (admin) — every review, newest first, filterable by status and rating.
const listAllReviews = async (req, res) => {
    const paging = pageParams(req.query, 20, 100);
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const rating = typeof req.query.rating === 'string' ? req.query.rating : '';
    if (!paging || !['all', 'visible', 'hidden'].includes(status) || (rating && !RATINGS.includes(rating))) {
        return res.status(400).json({ message: 'Invalid review filters' });
    }

    const filter = {};
    if (status !== 'all') filter.hidden = status === 'hidden';
    if (rating) filter.rating = rating;
    try {
        const [reviews, total, hiddenCount, allCount] = await Promise.all([
            Review.find(filter).sort({ createdAt: -1, _id: -1 })
                .skip((paging.page - 1) * paging.limit).limit(paging.limit)
                .populate('product', 'name imageUrls')
                .populate('user', 'name email')
                .lean(),
            Review.countDocuments(filter),
            Review.countDocuments({ hidden: true }),
            Review.estimatedDocumentCount(),
        ]);
        return res.json({
            reviews,
            counts: { all: allCount, visible: Math.max(allCount - hiddenCount, 0), hidden: hiddenCount },
            pagination: { ...paging, total, pages: Math.ceil(total / paging.limit) },
        });
    } catch (error) {
        console.error('Admin list reviews error:', error.message);
        return res.status(500).json({ message: 'Unable to load reviews' });
    }
};

// PATCH /api/reviews/:id (admin) — { hidden: true | false }
const setReviewHidden = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid review ID' });
    if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ message: 'hidden must be true or false' });
    try {
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { $set: { hidden: req.body.hidden, hiddenAt: req.body.hidden ? new Date() : null } },
            { returnDocument: 'after' },
        ).populate('product', 'name imageUrls').populate('user', 'name email');
        if (!review) return res.status(404).json({ message: 'Review not found' });
        // The product may have been deleted since; its reviews go with it, but be safe.
        if (review.product) await refreshProductRating(review.product._id);
        return res.json({
            message: review.hidden ? 'Review hidden from customers' : 'Review is visible again',
            review,
        });
    } catch (error) {
        console.error('Hide review error:', error.message);
        return res.status(500).json({ message: 'Unable to update the review' });
    }
};

module.exports = {
    listProductReviews, myProductReview, saveProductReview, deleteMyReview, listAllReviews, setReviewHidden,
};
