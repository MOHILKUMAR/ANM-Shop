const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { listAllReviews, setReviewHidden } = require('../controller/reviewController');

// Admin moderation. Customers read and write reviews under /api/products/:id/reviews.
const router = express.Router();

router.get('/', protect, admin, listAllReviews);
router.patch('/:id', protect, admin, setReviewHidden);

module.exports = router;
