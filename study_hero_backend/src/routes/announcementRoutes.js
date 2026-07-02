const express = require('express');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const db = require('../config/db');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

const router = express.Router();

function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

router.post('/', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { course_id, title, message } = req.body;
        if (!course_id || !title || !message) {
            return res.status(400).json({ error: 'course_id, title, and message are required' });
        }

        const [courses] = await db.query('SELECT id, title, teacher_id FROM courses WHERE id = ? AND teacher_id = ?', [course_id, req.user.id]);
        if (courses.length === 0) {
            return res.status(403).json({ error: 'Not authorized to post announcements for this course' });
        }

        const [result] = await db.query(`
            INSERT INTO announcements (course_id, teacher_id, title, message)
            VALUES (?, ?, ?, ?)
        `, [course_id, req.user.id, title, message]);

        eventBus.emitDomain(EVENTS.ANNOUNCEMENT_CREATED, {
            actorId: req.user.id,
            courseId: Number(course_id),
            courseTitle: courses[0].title,
            announcementId: result.insertId,
            announcementTitle: title,
            entityType: 'announcement',
            entityId: result.insertId,
            referenceType: 'announcement',
            referenceId: result.insertId,
            activityMetadata: { title },
            ...getClientInfo(req)
        });

        res.status(201).json({ message: 'Announcement posted successfully', announcementId: result.insertId });
    } catch (error) {
        console.error('Announcement create error:', error);
        res.status(500).json({ error: 'Failed to post announcement' });
    }
});

router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const accessQuery = req.user.role === 'teacher'
            ? 'SELECT id FROM courses WHERE id = ? AND teacher_id = ?'
            : 'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = \'active\'';
        const [access] = await db.query(accessQuery, [courseId, req.user.id]);
        if (access.length === 0) {
            return res.status(403).json({ error: 'Not authorized to view announcements for this course' });
        }

        const [announcements] = await db.query(`
            SELECT a.*, u.username AS teacher_name
            FROM announcements a
            JOIN users u ON u.id = a.teacher_id
            WHERE a.course_id = ?
            ORDER BY a.created_at DESC
        `, [courseId]);

        res.json(announcements);
    } catch (error) {
        console.error('Announcement list error:', error);
        res.status(500).json({ error: 'Failed to load announcements' });
    }
});

module.exports = router;