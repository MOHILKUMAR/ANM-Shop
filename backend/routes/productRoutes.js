const express = require('express');
// const router = express.Router();
const {protect  } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { getProducts, getAdminProducts, createProduct, getProductById, lookupProducts, updateProduct, deleteProduct } = require('../controller/ProductController');
const { listProductReviews, myProductReview, saveProductReview, deleteMyReview } = require('../controller/reviewController');
const { reviewLimiter, lookupLimiter } = require('../middleware/rateLimiters');
const multer = require('multer');
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
	fileFilter(req, file, callback) {
		if (!acceptedImageTypes.has(file.mimetype)) {
			return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
		}
		return callback(null, true);
	},
});


const router = express.Router();
//all products
router.route('/').get(getProducts).post(protect, admin,upload.single('image')  ,createProduct);
router.get('/manage', protect, admin, getAdminProducts);
router.get('/lookup', lookupLimiter, lookupProducts);
router.route('/:id/reviews').get(listProductReviews).post(protect, reviewLimiter, saveProductReview);
router.route('/:id/reviews/mine').get(protect, myProductReview).delete(protect, reviewLimiter, deleteMyReview);

//specific products
router.route('/:id').get(getProductById).put(protect , admin, upload.single('image'), updateProduct).delete(protect, admin ,deleteProduct);

module.exports = router;
