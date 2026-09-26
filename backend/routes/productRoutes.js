const express = require('express');
// const router = express.Router();
const {protect  } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { getProducts, getAdminProducts, createProduct, getProductById, createProductReview, updateProduct, deleteProduct } = require('../controller/ProductController');
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
router.post('/:id/reviews', protect, createProductReview);

//specific products
router.route('/:id').get(getProductById).put(protect , admin, upload.single('image'), updateProduct).delete(protect, admin ,deleteProduct);

module.exports = router;
