const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { listCoupons, createCoupon, updateCoupon, deleteCoupon, myCoupons } = require('../controller/couponController');

const router = express.Router();

router.get('/mine', protect, myCoupons);
router.route('/').get(protect, admin, listCoupons).post(protect, admin, createCoupon);
router.route('/:id').put(protect, admin, updateCoupon).delete(protect, admin, deleteCoupon);

module.exports = router;
