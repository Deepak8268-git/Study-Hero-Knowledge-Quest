const { getSocketServer } = require('./socketServer');

function emitToRoom(room, eventName, payload) {
    const io = getSocketServer();
    if (!io) return;
    io.to(room).emit(eventName, payload);
}

function emitToUser(userId, eventName, payload) {
    emitToRoom(`user:${userId}`, eventName, payload);
}

function emitToTeacher(teacherId, eventName, payload) {
    emitToRoom(`teacher:${teacherId}`, eventName, payload);
}

function emitToCourse(courseId, eventName, payload) {
    emitToRoom(`course:${courseId}`, eventName, payload);
}

function emitToRole(role, eventName, payload) {
    emitToRoom(`role:${role}`, eventName, payload);
}

module.exports = {
    emitToRoom,
    emitToUser,
    emitToTeacher,
    emitToCourse,
    emitToRole
};
