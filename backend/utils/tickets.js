const Order = require('../model/Order');
const Ticket = require('../model/Ticket');
const sendEmail = require('./sendEmail');
const { shortCode, customerOrderFilter } = require('./orderLookup');

const { TICKET_CATEGORIES } = Ticket;
const MAX_OPEN_TICKETS = 10;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

class TicketError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

const statusLabels = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Shared by the support form and the chat assistant so both follow the same rules.
const createTicket = async ({ user, subject, category, description, orderCode, source }) => {
    const cleanSubject = text(subject);
    const cleanDescription = text(description);
    if (cleanSubject.length < 3 || cleanSubject.length > 150) {
        throw new TicketError('The subject must be between 3 and 150 characters');
    }
    if (!TICKET_CATEGORIES.includes(category)) {
        throw new TicketError(`Choose a category: ${TICKET_CATEGORIES.join(', ')}`);
    }
    if (cleanDescription.length < 10 || cleanDescription.length > 4000) {
        throw new TicketError('Describe the problem in 10 to 4000 characters');
    }

    let order = null;
    if (text(orderCode)) {
        const filter = customerOrderFilter(user._id, orderCode);
        order = filter ? await Order.findOne(filter).select('_id') : null;
        if (!order) throw new TicketError(`No order ${text(orderCode)} was found on this account`, 404);
    }

    // A double-submitted form or a repeated request to the assistant returns the same ticket.
    const duplicate = await Ticket.findOne({
        user: user._id,
        subject: cleanSubject,
        status: { $in: ['open', 'in_progress'] },
        createdAt: { $gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    });
    if (duplicate) return { ticket: duplicate, duplicate: true };

    const openCount = await Ticket.countDocuments({ user: user._id, status: { $in: ['open', 'in_progress'] } });
    if (openCount >= MAX_OPEN_TICKETS) {
        throw new TicketError('You already have 10 open tickets. Our team will reply to those first.', 409);
    }

    const ticket = await Ticket.create({
        user: user._id,
        subject: cleanSubject,
        category,
        description: cleanDescription,
        order: order?._id,
        source,
    });
    return { ticket, duplicate: false };
};

// Best effort: a failed email never blocks the ticket update itself.
const notifyCustomer = (email, ticket, headline, detail) => {
    if (!email) return;
    const storefront = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
    const code = shortCode(ticket._id);
    const body = `${headline} ${detail} View the ticket on your Support page: ${storefront}/support`;
    const escape = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#33252e"><h1 style="color:#754656;font-size:22px">Ticket ${code}: ${escape(ticket.subject)}</h1><p>${escape(headline)}</p><p style="white-space:pre-wrap">${escape(detail)}</p><p><a href="${storefront}/support" style="color:#754656;font-weight:bold">Open your Support page</a></p></div>`;
    sendEmail(email, `Update on your ANM-Shop ticket ${code}`, body, html)
        .then((sent) => sent || console.error('Ticket update email was not sent'))
        .catch((error) => console.error('Ticket update email failed:', error.message));
};

module.exports = { TicketError, createTicket, notifyCustomer, statusLabels, TICKET_CATEGORIES };
