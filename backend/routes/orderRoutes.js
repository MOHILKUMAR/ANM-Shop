const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {admin} = require('../middleware/adminMiddleware');
const { invoiceEmailLimiter } = require('../middleware/rateLimiters');

const { getOrders, myOrders, resendOrderInvoice, updateOrderstatus, deleteOrder, cancelOrder, returnOrder, retryOrderRefund } = require('../controller/orderController.js');


const router = express.Router();

router.route('/').get(protect, admin, getOrders);
router.route('/myorders').get(protect, myOrders);
router.post('/:id/resend-invoice', protect, invoiceEmailLimiter, resendOrderInvoice);
router.route('/:id/status').put(protect, admin, updateOrderstatus);
router.post('/:id/cancel', protect, cancelOrder);
router.post('/:id/return', protect, admin, returnOrder);
router.post('/:id/refund', protect, admin, retryOrderRefund);
router.delete('/:id', protect, admin, deleteOrder);


module.exports = router;


