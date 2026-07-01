const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'JWT secret is not configured' });
        }

        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;

        if (!userId) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        
        // Verify user still exists
        const [users] = await db.query('SELECT id, role, password_changed_at FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const passwordChangedAt = users[0].password_changed_at ? new Date(users[0].password_changed_at).getTime() : 0;
        if (decoded.pwd !== undefined && Number(decoded.pwd) < passwordChangedAt) {
            return res.status(401).json({ error: 'Token expired after password change' });
        }

        req.user = {
            id: users[0].id,
            role: users[0].role
        };
        
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const teacherMiddleware = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied. Teacher only.' });
    }
    next();
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

module.exports = {
    authMiddleware,
    teacherMiddleware,
    adminMiddleware
};
