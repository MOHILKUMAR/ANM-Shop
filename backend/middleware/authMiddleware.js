const jwt = require('jsonwebtoken');
const User = require('../model/User');

const protect = async(req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        const token = authorization.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
            return res.status(401).json({ message: 'Account no longer exists' });
        }
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired authentication token' });
    }
};

module.exports = {
    protect
}