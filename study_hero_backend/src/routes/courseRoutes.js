const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

// Get all courses visible to the authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const query = req.user.role === 'teacher'
            ? `
                SELECT c.*, u.username as teacher_name
                FROM courses c
                JOIN users u ON c.teacher_id = u.id
                WHERE c.teacher_id = ?
                ORDER BY c.updated_at DESC, c.created_at DESC
            `
            : `
                SELECT c.*, u.username as teacher_name
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                JOIN users u ON c.teacher_id = u.id
                WHERE e.student_id = ? AND e.status = 'active'
                ORDER BY c.updated_at DESC, c.created_at DESC
            `;

        const [courses] = await db.query(query, [req.user.id]);
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get course by ID when the user owns it or is enrolled in it
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const query = req.user.role === 'teacher'
            ? `
                SELECT c.*, u.username as teacher_name
                FROM courses c
                JOIN users u ON c.teacher_id = u.id
                WHERE c.id = ? AND c.teacher_id = ?
            `
            : `
                SELECT c.*, u.username as teacher_name
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                JOIN users u ON c.teacher_id = u.id
                WHERE c.id = ? AND e.student_id = ? AND e.status = 'active'
            `;

        const [courses] = await db.query(query, [req.params.id, req.user.id]);
        if (courses.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json(courses[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new course (teacher only)
router.post('/', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Course title is required' });
        }

        const [result] = await db.query(
            'INSERT INTO courses (title, description, teacher_id) VALUES (?, ?, ?)',
            [title, description || null, req.user.id]
        );

        eventBus.emitDomain(EVENTS.COURSE_CREATED, {
            actorId: req.user.id,
            courseId: result.insertId,
            courseTitle: title,
            entityType: 'course',
            entityId: result.insertId,
            referenceType: 'course',
            referenceId: result.insertId,
            activityMetadata: { title },
            ...getClientInfo(req)
        });

        res.status(201).json({ message: 'Course created successfully', courseId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update course (teacher only)
router.put('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Course title is required' });
        }

        const [result] = await db.query(
            'UPDATE courses SET title = ?, description = ? WHERE id = ? AND teacher_id = ?',
            [title, description || null, req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        eventBus.emitDomain(EVENTS.COURSE_UPDATED, {
            actorId: req.user.id,
            courseId: Number(req.params.id),
            courseTitle: title,
            entityType: 'course',
            entityId: Number(req.params.id),
            referenceType: 'course',
            referenceId: Number(req.params.id),
            activityMetadata: { title },
            ...getClientInfo(req)
        });

        res.json({ message: 'Course updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete course (teacher only)
router.delete('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM courses WHERE id = ? AND teacher_id = ?', [req.params.id, req.user.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;