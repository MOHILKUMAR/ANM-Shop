const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { getCategories, getCategoriesForAdmin, createCategory, updateCategory, deleteCategory } = require('../controller/categoryController');

const router = express.Router();

router.route('/').get(getCategories).post(protect, admin, createCategory);
router.get('/manage', protect, admin, getCategoriesForAdmin);
router.route('/:id').put(protect, admin, updateCategory).delete(protect, admin, deleteCategory);

module.exports = router;
