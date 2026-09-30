const mongoose = require('mongoose');
const Product = require('../model/Product');
const Review = require('../model/Review');

// "Priya Sharma" -> "Priya S.": enough to feel personal without publishing full names.
const publicName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Customer';
    const first = parts[0].slice(0, 40);
    return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
};

// Recounts a product's visible reviews and stores the totals on the product.
const refreshProductRating = async (productId) => {
    const groups = await Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(String(productId)), hidden: false } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    const counts = { bad: 0, good: 0, excellent: 0 };
    for (const group of groups) {
        if (group._id in counts) counts[group._id] = group.count;
    }
    const total = counts.bad + counts.good + counts.excellent;
    await Product.updateOne({ _id: productId }, { $set: { ratingCounts: counts, numReviews: total } });
    return { total, counts };
};

// Products used to hold 1-5 star ratings in an embedded `reviews` array. Moves any of those
// into the Review collection (1-2 stars = bad, 3-4 = good, 5 = excellent), then removes the
// old fields. Does nothing once there is nothing left to move, so it is safe on every start.
const migrateEmbeddedReviews = async () => {
    const products = await Product.collection
        .find({ 'reviews.0': { $exists: true } }, { projection: { reviews: 1 } })
        .toArray();
    for (const product of products) {
        for (const old of product.reviews) {
            if (!old?.user) continue;
            const stars = Number(old.rating) || 0;
            const rating = stars >= 5 ? 'excellent' : stars >= 3 ? 'good' : 'bad';
            await Review.updateOne(
                { product: product._id, user: old.user },
                { $setOnInsert: { name: publicName(old.name), rating, comment: '', createdAt: old.createdAt || new Date(), updatedAt: old.updatedAt || new Date() } },
                { upsert: true, timestamps: false },
            );
        }
        await refreshProductRating(product._id);
    }
    await Product.collection.updateMany(
        { $or: [{ reviews: { $exists: true } }, { rating: { $exists: true } }] },
        { $unset: { reviews: '', rating: '' } },
    );
    if (products.length) console.log(`Moved reviews from ${products.length} product(s) to the reviews collection`);
};

module.exports = { publicName, refreshProductRating, migrateEmbeddedReviews };
