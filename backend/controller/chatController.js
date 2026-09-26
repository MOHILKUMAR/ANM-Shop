const { ApiError } = require('@google/genai');
const ChatConversation = require('../model/ChatConversation');
const { runAssistantTurn, isAssistantConfigured } = require('../utils/supportAssistant');

const MAX_MESSAGE_LENGTH = 1000;
// A long chat is started fresh rather than trimmed, so the saved history is only ever appended to.
const MAX_TURNS = 30;
const BUSY_MS = 5 * 60 * 1000;

// Only what the chat window needs to show; the full product snapshot stays out of the transcript.
const displayActions = (actions) => actions.map((action) => (action.type === 'add_to_cart'
    ? { type: action.type, quantity: action.quantity, name: action.product.name }
    : action));

const getConversation = async (userId) => {
    const existing = await ChatConversation.findOne({ user: userId });
    if (existing) return existing;
    try {
        return await ChatConversation.create({ user: userId });
    } catch (error) {
        if (error.code === 11000) return ChatConversation.findOne({ user: userId }); // created concurrently
        throw error;
    }
};

const getChat = async (req, res) => {
    try {
        const conversation = await ChatConversation.findOne({ user: req.user._id }).select('transcript turns').lean();
        return res.json({
            configured: isAssistantConfigured(),
            messages: conversation?.transcript || [],
            turnsLeft: MAX_TURNS - (conversation?.turns || 0),
        });
    } catch (error) {
        console.error('Load chat error:', error.message);
        return res.status(500).json({ message: 'Unable to load the chat' });
    }
};

const sendChatMessage = async (req, res) => {
    if (!isAssistantConfigured()) {
        return res.status(503).json({ message: 'The support assistant is not available right now. You can open a ticket on the Support page.' });
    }
    const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!text || text.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ message: `Write a message of up to ${MAX_MESSAGE_LENGTH} characters` });
    }

    let conversation;
    try {
        const existing = await getConversation(req.user._id);
        const now = new Date();
        // Claim the conversation so a second message can't interleave with this reply.
        conversation = await ChatConversation.findOneAndUpdate(
            { _id: existing._id, $or: [{ busyUntil: null }, { busyUntil: { $lt: now } }] },
            { $set: { busyUntil: new Date(now.getTime() + BUSY_MS) } },
            { new: true },
        );
    } catch (error) {
        console.error('Chat claim error:', error.message);
        return res.status(500).json({ message: 'Unable to send your message' });
    }
    if (!conversation) {
        return res.status(429).json({ message: 'Still answering your previous message. Please wait a moment.' });
    }

    const release = (update = {}) => ChatConversation.updateOne({ _id: conversation._id }, { $set: { ...update, busyUntil: null } });
    if (conversation.turns >= MAX_TURNS) {
        await release();
        return res.status(409).json({ message: 'This chat has reached its length limit. Start a new chat to continue.', chatFull: true });
    }

    const sentAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    const history = [...JSON.parse(conversation.apiMessages), { role: 'user', parts: [{ text: `[Sent ${sentAt} IST] ${text}` }] }];
    const customerEntry = { role: 'customer', text, at: new Date() };
    const transcript = [...conversation.transcript.map((entry) => entry.toObject()), customerEntry];

    try {
        const result = await runAssistantTurn(history, req.user, (progress) => ChatConversation.updateOne(
            { _id: conversation._id },
            { $set: { apiMessages: JSON.stringify(progress), transcript } },
        ));
        const assistantEntry = { role: 'assistant', text: result.reply, at: new Date() };
        if (result.actions.length) assistantEntry.actions = displayActions(result.actions);
        await release({
            apiMessages: JSON.stringify(result.messages),
            transcript: [...transcript, assistantEntry],
            turns: conversation.turns + 1,
        });
        return res.json({
            message: assistantEntry,
            // Full product details so the browser can add the items to its cart.
            actions: result.actions,
            turnsLeft: MAX_TURNS - conversation.turns - 1,
        });
    } catch (error) {
        await release().catch(() => {});
        if (error instanceof ApiError && error.status === 429) {
            // On the free tier this is usually the per-minute or daily quota.
            return res.status(503).json({ message: 'The assistant has reached its usage limit for now. Please try again later, or open a ticket on the Support page.' });
        }
        if (error instanceof ApiError && [400, 401, 403].includes(error.status)) {
            // Gemini reports an invalid or restricted API key as 400/403.
            console.error('Support assistant request rejected:', error.status, error.message);
            return res.status(503).json({ message: 'The support assistant is not available right now. You can open a ticket on the Support page.' });
        }
        if (error instanceof ApiError) {
            console.error('Support assistant API error:', error.status, error.message);
            return res.status(502).json({ message: 'The assistant could not answer just now. Please try again.' });
        }
        console.error('Support assistant error:', error.message);
        return res.status(500).json({ message: 'The assistant could not answer just now. Please try again.' });
    }
};

const resetChat = async (req, res) => {
    try {
        const result = await ChatConversation.deleteOne({
            user: req.user._id,
            $or: [{ busyUntil: null }, { busyUntil: { $lt: new Date() } }],
        });
        if (!result.deletedCount && await ChatConversation.exists({ user: req.user._id })) {
            return res.status(429).json({ message: 'Still answering your previous message. Please wait a moment.' });
        }
        return res.json({ message: 'Started a new chat' });
    } catch (error) {
        console.error('Reset chat error:', error.message);
        return res.status(500).json({ message: 'Unable to start a new chat' });
    }
};

module.exports = { getChat, sendChatMessage, resetChat };
