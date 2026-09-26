const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { ticketLimiter, ticketReplyLimiter } = require('../middleware/rateLimiters');
const {
    createTicketHandler, myTickets, addTicketMessage, listTickets, updateTicketStatus,
} = require('../controller/ticketController');

const router = express.Router();

router.post('/', protect, ticketLimiter, createTicketHandler);
router.get('/mine', protect, myTickets);
router.post('/:id/messages', protect, ticketReplyLimiter, addTicketMessage);
router.get('/', protect, admin, listTickets);
router.put('/:id/status', protect, admin, updateTicketStatus);

module.exports = router;
