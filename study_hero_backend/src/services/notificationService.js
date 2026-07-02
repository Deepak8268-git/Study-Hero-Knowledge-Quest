const db = require('../config/db');

function serializeNotification(row) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        recipientId: row.recipient_id,
        actorId: row.actor_id,
        courseId: row.course_id,
        type: row.type,
        title: row.title,
        message: row.message,
        priority: row.priority,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        metadata: row.metadata && typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        readAt: row.read_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getActiveCourseStudentIds(courseId) {
    const [students] = await db.query(`
        SELECT student_id
        FROM enrollments
        WHERE course_id = ? AND status = 'active'
    `, [courseId]);

    return students.map((student) => student.student_id);
}

async function getCourseTeacherId(courseId) {
    const [courses] = await db.query('SELECT teacher_id FROM courses WHERE id = ?', [courseId]);
    return courses[0]?.teacher_id || null;
}

async function createNotification({
    recipientId,
    actorId = null,
    courseId = null,
    type,
    title,
    message,
    priority = 'NORMAL',
    referenceType = null,
    referenceId = null,
    metadata = null,
    organizationId = null
}) {
    if (!recipientId) return null;

    const [result] = await db.query(`
        INSERT INTO notifications (
            organization_id, recipient_id, actor_id, course_id, type, title, message,
            priority, reference_type, reference_id, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        organizationId,
        recipientId,
        actorId,
        courseId,
        type,
        title,
        message,
        priority,
        referenceType,
        referenceId,
        metadata ? JSON.stringify(metadata) : null
    ]);

    const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    return rows[0] ? serializeNotification(rows[0]) : null;
}

async function createNotificationsForUsers({ recipientIds, ...notification }) {
    const uniqueRecipientIds = [...new Set((recipientIds || []).filter(Boolean))];
    const created = [];

    for (const recipientId of uniqueRecipientIds) {
        const item = await createNotification({ ...notification, recipientId });
        if (item) created.push(item);
    }

    return created;
}

async function createNotificationsForCourseStudents({ courseId, excludeUserIds = [], ...notification }) {
    const studentIds = await getActiveCourseStudentIds(courseId);
    const excluded = new Set(excludeUserIds);
    return createNotificationsForUsers({
        ...notification,
        courseId,
        recipientIds: studentIds.filter((studentId) => !excluded.has(studentId))
    });
}

async function listNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    const params = [userId];
    let where = 'recipient_id = ?';

    if (unreadOnly) {
        where += ' AND read_at IS NULL';
    }

    params.push(Number(limit), Number(offset));
    const [rows] = await db.query(`
        SELECT *
        FROM notifications
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, params);

    return rows.map(serializeNotification);
}

async function getUnreadCount(userId) {
    const [rows] = await db.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND read_at IS NULL',
        [userId]
    );
    return Number(rows[0]?.count || 0);
}

async function markRead(userId, notificationId) {
    await db.query(`
        UPDATE notifications
        SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = ? AND recipient_id = ?
    `, [notificationId, userId]);

    const [rows] = await db.query('SELECT * FROM notifications WHERE id = ? AND recipient_id = ?', [notificationId, userId]);
    return rows[0] ? serializeNotification(rows[0]) : null;
}

async function markAllRead(userId) {
    await db.query(`
        UPDATE notifications
        SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE recipient_id = ? AND read_at IS NULL
    `, [userId]);
    return getUnreadCount(userId);
}

async function deleteNotification(userId, notificationId) {
    const [result] = await db.query('DELETE FROM notifications WHERE id = ? AND recipient_id = ?', [notificationId, userId]);
    return result.affectedRows > 0;
}

module.exports = {
    serializeNotification,
    getActiveCourseStudentIds,
    getCourseTeacherId,
    createNotification,
    createNotificationsForUsers,
    createNotificationsForCourseStudents,
    listNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
    deleteNotification
};
