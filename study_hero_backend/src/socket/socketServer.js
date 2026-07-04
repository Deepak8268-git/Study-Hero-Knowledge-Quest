const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

let ioInstance = null;
const onlineUsers = new Map();

function publicPresence(userId, status = 'online') {
    const existing = onlineUsers.get(Number(userId));
    return {
        userId: Number(userId),
        status,
        lastSeen: existing?.lastSeen || new Date().toISOString()
    };
}

function emitPresence(io, userId, status) {
    io.emit('presence:update', publicPresence(userId, status));
}

async function authenticateSocket(socket, next) {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        if (!userId) {
            return next(new Error('Invalid token payload'));
        }

        const [users] = await db.query('SELECT id, role, password_changed_at FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return next(new Error('User not found'));
        }

        const user = users[0];
        const passwordChangedAt = user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
        if (decoded.pwd !== undefined && Number(decoded.pwd) < passwordChangedAt) {
            return next(new Error('Token expired after password change'));
        }

        socket.user = { id: user.id, role: user.role };
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
}

async function joinAuthorizedCourse(socket, courseId) {
    const numericCourseId = Number(courseId);
    if (!numericCourseId) return false;

    if (socket.user.role === 'teacher') {
        const [courses] = await db.query('SELECT id FROM courses WHERE id = ? AND teacher_id = ?', [numericCourseId, socket.user.id]);
        if (courses.length === 0) return false;
    } else if (socket.user.role === 'student') {
        const [enrollments] = await db.query(`
            SELECT id FROM enrollments
            WHERE course_id = ? AND student_id = ? AND status = 'active'
        `, [numericCourseId, socket.user.id]);
        if (enrollments.length === 0) return false;
    } else {
        return false;
    }

    socket.join(`course:${numericCourseId}`);
    return true;
}

async function joinInitialRooms(socket) {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);

    if (socket.user.role === 'teacher') {
        socket.join(`teacher:${socket.user.id}`);
        const [courses] = await db.query('SELECT id FROM courses WHERE teacher_id = ?', [socket.user.id]);
        courses.forEach((course) => socket.join(`course:${course.id}`));
    }

    if (socket.user.role === 'student') {
        const [courses] = await db.query(`
            SELECT course_id FROM enrollments
            WHERE student_id = ? AND status = 'active'
        `, [socket.user.id]);
        courses.forEach((course) => socket.join(`course:${course.course_id}`));
    }
}

function initializeSocketServer(httpServer, allowedOrigins) {
    ioInstance = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.has(origin)) {
                    return callback(null, true);
                }
                callback(new Error(`Socket CORS blocked origin: ${origin}`));
            },
            credentials: true
        }
    });

    ioInstance.use(authenticateSocket);

    ioInstance.on('connection', async (socket) => {
        try {
            await joinInitialRooms(socket);
            const currentPresence = onlineUsers.get(socket.user.id) || { sockets: new Set(), lastSeen: new Date().toISOString() };
            currentPresence.sockets.add(socket.id);
            currentPresence.lastSeen = new Date().toISOString();
            onlineUsers.set(socket.user.id, currentPresence);
            emitPresence(ioInstance, socket.user.id, 'online');
            socket.emit('socket:connected', { userId: socket.user.id, role: socket.user.role });
            socket.emit('presence:sync', Array.from(onlineUsers.keys()).map((userId) => publicPresence(userId, 'online')));

            socket.on('presence:ping', (callback) => {
                const presence = onlineUsers.get(socket.user.id);
                if (presence) presence.lastSeen = new Date().toISOString();
                if (typeof callback === 'function') callback(publicPresence(socket.user.id, 'online'));
            });

            socket.on('course:join', async ({ courseId }, callback) => {
                const joined = await joinAuthorizedCourse(socket, courseId);
                if (typeof callback === 'function') {
                    callback({ ok: joined });
                }
            });

            socket.on('disconnect', () => {
                const presence = onlineUsers.get(socket.user.id);
                if (!presence) return;
                presence.sockets.delete(socket.id);
                presence.lastSeen = new Date().toISOString();
                if (presence.sockets.size === 0) {
                    onlineUsers.set(socket.user.id, presence);
                    emitPresence(ioInstance, socket.user.id, 'offline');
                    onlineUsers.delete(socket.user.id);
                } else {
                    onlineUsers.set(socket.user.id, presence);
                }
            });
        } catch (error) {
            socket.emit('socket:error', { message: 'Unable to initialize socket rooms' });
            socket.disconnect(true);
        }
    });

    return ioInstance;
}

function getSocketServer() {
    return ioInstance;
}

module.exports = {
    initializeSocketServer,
    getSocketServer,
    joinAuthorizedCourse,
    publicPresence
};
