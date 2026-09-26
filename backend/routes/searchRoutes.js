const express = require('express');
const { searchRecords } = require('../controller/searchController.js');
const { protect } = require('../middleware/authMiddleware.js');
const { admin } = require('../middleware/adminMiddleware.js');

const router = express.Router();

router.get('/', protect, admin, searchRecords);

module.exports = router;
