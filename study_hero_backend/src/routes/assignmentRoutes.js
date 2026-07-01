const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');

async function canAccessCourse(user, courseId) {
    if (user.role === 'teacher') {
        const [courses] = await db.query('SELECT id FROM courses WHERE id = ? AND teacher_id = ?', [courseId, user.id]);
        return courses.length > 0;
    }

    const [enrollments] = await db.query(
        'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = \'active\'',
        [courseId, user.id]
    );
    return enrollments.length > 0;
}

async function canAccessAssignment(user, assignmentId) {
    const [assignments] = await db.query(`
        SELECT a.id, a.course_id, c.teacher_id
        FROM assignments a
        JOIN courses c ON c.id = a.course_id
        WHERE a.id = ?
    `, [assignmentId]);

    if (assignments.length === 0) {
        return { allowed: false, assignment: null };
    }

    const assignment = assignments[0];
    if (user.role === 'teacher') {
        return { allowed: assignment.teacher_id === user.id, assignment };
    }

    const [enrollments] = await db.query(
        'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = \'active\'',
        [assignment.course_id, user.id]
    );
    return { allowed: enrollments.length > 0, assignment };
}

// Get all assignments for an accessible course
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const allowed = await canAccessCourse(req.user, req.params.courseId);
        if (!allowed) {
            return res.status(403).json({ error: 'Not authorized to view assignments for this course' });
        }

        const [assignments] = await db.query(`
            SELECT a.*, c.title as course_title
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.course_id = ?
            ORDER BY a.due_date ASC, a.created_at DESC
        `, [req.params.courseId]);

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a single assignment when accessible
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const access = await canAccessAssignment(req.user, req.params.id);
        if (!access.assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        if (!access.allowed) {
            return res.status(403).json({ error: 'Not authorized to view this assignment' });
        }

        const [assignments] = await db.query(`
            SELECT a.*, c.title as course_title
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?
        `, [req.params.id]);

        res.json(assignments[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new assignment (teacher only)
router.post('/', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { course_id, title, description, due_date } = req.body;

        if (!course_id || !title) {
            return res.status(400).json({ error: 'course_id and title are required' });
        }

        const [courses] = await db.query(
            'SELECT teacher_id FROM courses WHERE id = ?',
            [course_id]
        );

        if (courses.length === 0 || courses[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to create assignments for this course' });
        }

        const [result] = await db.query(`
            INSERT INTO assignments (course_id, title, description, due_date)
            VALUES (?, ?, ?, ?)
        `, [course_id, title, description || null, due_date || null]);

        res.status(201).json({
            message: 'Assignment created successfully',
            assignmentId: result.insertId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update assignment (teacher only)
router.put('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { title, description, due_date } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Assignment title is required' });
        }

        const [assignments] = await db.query(`
            SELECT c.teacher_id
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?
        `, [req.params.id]);

        if (assignments.length === 0 || assignments[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to update this assignment' });
        }

        await db.query(`
            UPDATE assignments
            SET title = ?, description = ?, due_date = ?
            WHERE id = ?
        `, [title, description || null, due_date || null, req.params.id]);

        res.json({ message: 'Assignment updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete assignment (teacher only)
router.delete('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [assignments] = await db.query(`
            SELECT c.teacher_id
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?
        `, [req.params.id]);

        if (assignments.length === 0 || assignments[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this assignment' });
        }

        await db.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;