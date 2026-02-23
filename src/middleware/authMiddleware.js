const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authMiddleware = async (req, res, next) => {
    try {
        // Accept token from cookie or Authorization header
        const token = (req.cookies && req.cookies.token) || (req.header('Authorization') || '').replace('Bearer ', '');
        if (!token) {
            return res.status(401).send('Unauthorized: No token provided');
        }

        const secret = process.env.JWT_SECRET || 'Anjali@singh#123';
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (verifyErr) {
            console.error('JWT verification failed:', verifyErr.message);
            return res.status(401).send('ERROR: invalid token - ' + verifyErr.message);
        }

        console.log('authMiddleware: token present, decoded payload =', decoded);

        const userId = decoded.id || decoded._id || decoded.userId;
        if (!userId) {
            console.error('authMiddleware: no user id in token payload');
            return res.status(401).send('ERROR: no user id in token');
        }

        const user = await User.findById(userId);
        console.log('authMiddleware: findById(', userId, ') ->', !!user);

        if (!user) {
            return res.status(404).send('User not found');
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('authMiddleware error:', err);
        res.status(401).send('ERROR:' + err.message);
    }
};

module.exports = authMiddleware;