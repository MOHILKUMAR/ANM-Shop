const mongoose = require('mongoose');

const TICKET_CATEGORIES = ['order', 'payment', 'refund', 'delivery', 'return', 'product', 'account', 'other'];
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const ticketMessageSchema = new mongoose.Schema(
  {
    author: { type: String, enum: ['customer', 'admin'], required: true },
    authorName: { type: String, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    // Whether the customer filled in the form or the support assistant opened it for them.
    source: { type: String, enum: ['customer', 'assistant'], default: 'customer' },
    messages: [ticketMessageSchema],
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ticketSchema.index({ user: 1, lastActivityAt: -1 });
ticketSchema.index({ status: 1, lastActivityAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
module.exports.TICKET_CATEGORIES = TICKET_CATEGORIES;
module.exports.TICKET_STATUSES = TICKET_STATUSES;
