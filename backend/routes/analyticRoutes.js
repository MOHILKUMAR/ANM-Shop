const express = require('express');
const {getAdminStats} = require('../controller/AnalyticsController.js');
const { protect } = require('../middleware/authMiddleware.js');
const { admin } = require('../middleware/adminMiddleware.js');


const router = express.Router();

router.get("/", protect, admin, getAdminStats);

module.exports = router;

