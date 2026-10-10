const mongoose = require('mongoose');
const Ticket = require('../model/Ticket');
const { TicketError, createTicket, notifyCustomer, statusLabels } = require('../utils/tickets');
const { shortCode } = require('../utils/orderLookup');

const { TICKET_STATUSES } = Ticket;

// Customers see replies as coming from the store team, not from an individual admin.
const serializeTicket = (ticket, { forAdmin = false } = {}) => ({
    _id: ticket._id,
    code: shortCode(ticket._id),
    subject: ticket.subject,
    category: ticket.category,
    description: ticket.description,
    status: ticket.status,
    source: ticket.source,
    order: ticket.order ? {
        _id: ticket.order._id || ticket.order,
        code: shortCode(ticket.order._id || ticket.order),
        ...(forAdmin && ticket.order.totalAmount !== undefined ? {
            totalAmount: ticket.order.totalAmount,
            status: ticket.order.status,
            paymentId: ticket.order.paymentId,
            createdAt: ticket.order.createdAt,
        } : {}),
    } : null,
    messages: (ticket.messages || []).map((message) => ({
        author: message.author,
        authorName: message.author === 'admin' && !forAdmin ? 'ANM-Shop support' : message.authorName,
        body: message.body,
        createdAt: message.createdAt,
    })),
    ...(forAdmin ? { user: ticket.user ? { _id: ticket.user._id, name: ticket.user.name, email: ticket.user.email } : null } : {}),
    createdAt: ticket.createdAt,
    lastActivityAt: ticket.lastActivityAt,
});

const handleError = (res, error, fallback) => {
    if (error instanceof TicketError) return res.status(error.statusCode).json({ message: error.message });
    console.error(`${fallback}:`, error.message);
    return res.status(500).json({ message: fallback });
};

const createTicketHandler = async (req, res) => {
    try {
        const { ticket, duplicate } = await createTicket({
            user: req.user,
            subject: req.body.subject,
            category: req.body.category,
            description: req.body.description,
            orderCode: req.body.orderCode,
            source: 'customer',
        });
        return res.status(duplicate ? 200 : 201).json({
            message: duplicate ? 'You already opened this ticket a moment ago.' : `Ticket ${shortCode(ticket._id)} created. Our team will reply here.`,
            ticket: serializeTicket(ticket),
        });
    } catch (error) {
        return handleError(res, error, 'Unable to create the ticket');
    }
};

const myTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user._id }).sort({ lastActivityAt: -1 }).limit(50).lean();
        return res.json(tickets.map((ticket) => serializeTicket(ticket)));
    } catch (error) {
        return handleError(res, error, 'Unable to load your tickets');
    }
};

const addTicketMessage = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid ticket ID' });
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body || body.length > 4000) return res.status(400).json({ message: 'Write a reply of up to 4000 characters' });

    const isAdmin = req.user.role === 'admin';
    try {
        const filter = isAdmin ? { _id: req.params.id } : { _id: req.params.id, user: req.user._id };
        const ticket = await Ticket.findOne(filter).populate('user', 'name email');
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (ticket.status === 'closed' && !isAdmin) {
            return res.status(409).json({ message: 'This ticket is closed. Open a new ticket if you still need help.' });
        }

        ticket.messages.push({ author: isAdmin ? 'admin' : 'customer', authorName: req.user.name, body });
        // An admin reply means the team has picked it up; a customer reply reopens a resolved ticket.
        if (isAdmin && ticket.status === 'open') ticket.status = 'in_progress';
        if (!isAdmin && ticket.status === 'resolved') ticket.status = 'open';
        ticket.lastActivityAt = new Date();
        await ticket.save();

        if (isAdmin) notifyCustomer(ticket.user?.email, ticket, 'The ANM-Shop team replied to your ticket:', body);
        return res.status(201).json(serializeTicket(ticket, { forAdmin: isAdmin }));
    } catch (error) {
        return handleError(res, error, 'Unable to send the reply');
    }
};

// GET /api/tickets — every ticket for admins, latest activity first, 50 per page.
const ADMIN_PAGE_SIZE = 50;
const listTickets = async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status && !TICKET_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid ticket status' });
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (page < 1) return res.status(400).json({ message: 'Invalid page number' });
    const filter = status ? { status } : {};

    try {
        const [tickets, total, counts] = await Promise.all([
            Ticket.find(filter)
                .sort({ lastActivityAt: -1 })
                .skip((page - 1) * ADMIN_PAGE_SIZE)
                .limit(ADMIN_PAGE_SIZE)
                .populate('user', 'name email')
                .populate('order', 'totalAmount status paymentId createdAt')
                .lean(),
            Ticket.countDocuments(filter),
            Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);
        const byStatus = Object.fromEntries(TICKET_STATUSES.map((value) => [value, 0]));
        counts.forEach(({ _id, count }) => { if (_id in byStatus) byStatus[_id] = count; });
        return res.json({
            tickets: tickets.map((ticket) => serializeTicket(ticket, { forAdmin: true })),
            counts: byStatus,
            pagination: { page, limit: ADMIN_PAGE_SIZE, total, pages: Math.ceil(total / ADMIN_PAGE_SIZE) },
        });
    } catch (error) {
        return handleError(res, error, 'Unable to load tickets');
    }
};

const updateTicketStatus = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid ticket ID' });
    const { status } = req.body;
    if (!TICKET_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid ticket status' });

    try {
        const ticket = await Ticket.findById(req.params.id).populate('user', 'name email').populate('order', 'totalAmount status paymentId createdAt');
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        const previous = ticket.status;
        ticket.status = status;
        ticket.lastActivityAt = new Date();
        await ticket.save();

        if (previous !== status) {
            notifyCustomer(ticket.user?.email, ticket, `Your ticket is now: ${statusLabels[status]}.`, `Subject: ${ticket.subject}`);
        }
        return res.json(serializeTicket(ticket, { forAdmin: true }));
    } catch (error) {
        return handleError(res, error, 'Unable to update the ticket');
    }
};

module.exports = { createTicketHandler, myTickets, addTicketMessage, listTickets, updateTicketStatus, serializeTicket };
