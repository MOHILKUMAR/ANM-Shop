// Customers see orders as "#" + the last 8 characters of the id (e.g. #9B54D5F2).
const shortCode = (id) => `#${String(id).slice(-8).toUpperCase()}`;

// A filter that finds one of this customer's orders from a full id or the short code
// (with or without "#"), or null when the value can't be an order id.
const customerOrderFilter = (userId, code) => {
    const value = typeof code === 'string' ? code.trim().replace(/^#/, '') : '';
    if (/^[0-9a-f]{24}$/i.test(value)) return { _id: value, user: userId };
    if (/^[0-9a-f]{6,23}$/i.test(value)) {
        return {
            user: userId,
            $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${value.toLowerCase()}$`, options: 'i' } },
        };
    }
    return null;
};

module.exports = { shortCode, customerOrderFilter };
