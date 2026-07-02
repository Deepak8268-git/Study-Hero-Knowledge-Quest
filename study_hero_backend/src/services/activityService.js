const db = require('../config/db');

async function logActivity({ actorId = null, targetUserId = null, courseId = null, entityType, entityId = null, action, metadata = null }) {
    try {
        await db.query(`
            INSERT INTO activity_events (actor_id, target_user_id, course_id, entity_type, entity_id, action, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [actorId, targetUserId, courseId, entityType, entityId, action, metadata ? JSON.stringify(metadata) : null]);
    } catch (error) {
        console.error('Activity log error:', error.message);
    }
}

module.exports = { logActivity };
