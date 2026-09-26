const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { chatLimiter } = require('../middleware/rateLimiters');
const { getChat, sendChatMessage, resetChat } = require('../controller/chatController');

const router = express.Router();

router.get('/', protect, getChat);
router.post('/messages', protect, chatLimiter, sendChatMessage);
router.delete('/', protect, resetChat);

module.exports = router;
