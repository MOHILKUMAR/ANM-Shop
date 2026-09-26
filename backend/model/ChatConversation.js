const mongoose = require('mongoose');

const transcriptEntrySchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['customer', 'assistant'], required: true },
    text: { type: String, required: true },
    // What the assistant did alongside its reply, e.g. items added to the cart or a ticket opened.
    actions: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  },
  { _id: false, timestamps: { createdAt: 'at', updatedAt: false } },
);

// One active support chat per customer.
const chatConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // The exact Gemini API history (function calls and thought signatures included), stored
    // as a JSON string so it is replayed byte-for-byte on the next turn.
    apiMessages: { type: String, default: '[]' },
    // What the customer sees in the chat window.
    transcript: [transcriptEntrySchema],
    turns: { type: Number, default: 0 },
    // Set while a reply is being generated so two messages can't interleave the history.
    busyUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
