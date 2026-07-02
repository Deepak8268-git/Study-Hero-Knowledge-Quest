const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

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
            'SELECT id, title, teacher_id FROM courses WHERE id = ?',
            [course_id]
        );

        if (courses.length === 0 || courses[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to create assignments for this course' });
        }

        const [result] = await db.query(`
            INSERT INTO assignments (course_id, title, description, due_date)
            VALUES (?, ?, ?, ?)
        `, [course_id, title, description || null, due_date || null]);

        eventBus.emitDomain(EVENTS.ASSIGNMENT_CREATED, {
            actorId: req.user.id,
            courseId: Number(course_id),
            courseTitle: courses[0].title,
            assignmentId: result.insertId,
            assignmentTitle: title,
            entityType: 'assignment',
            entityId: result.insertId,
            referenceType: 'assignment',
            referenceId: result.insertId,
            activityMetadata: { title },
            ...getClientInfo(req)
        });

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

// Submit assignment (student only)
router.post('/:id/submissions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: 'Only students can submit assignments' });
        }

        const { submission_text, submission_file } = req.body;
        const [assignments] = await db.query(`
            SELECT a.id, a.title, a.course_id, c.title AS course_title, c.teacher_id
            FROM assignments a
            JOIN courses c ON c.id = a.course_id
            WHERE a.id = ?
        `, [req.params.id]);

        if (assignments.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        const assignment = assignments[0];
        const enrolled = await canAccessCourse(req.user, assignment.course_id);
        if (!enrolled) {
            return res.status(403).json({ error: 'Not authorized to submit this assignment' });
        }

        const [existing] = await db.query(
            'SELECT id FROM submissions WHERE assignment_no = ? AND student_id = ?',
            [assignment.id, req.user.id]
        );

        let submissionId;
        if (existing.length > 0) {
            submissionId = existing[0].id;
            await db.query(`
                UPDATE submissions
                SET submission_text = ?, submission_file = ?, grade = NULL, status = 'submitted', submitted_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [submission_text || null, submission_file || null, submissionId]);
        } else {
            const [result] = await db.query(`
                INSERT INTO submissions (assignment_no, student_id, submission_text, submission_file)
                VALUES (?, ?, ?, ?)
            `, [assignment.id, req.user.id, submission_text || null, submission_file || null]);
            submissionId = result.insertId;
        }

        eventBus.emitDomain(EVENTS.ASSIGNMENT_SUBMITTED, {
            actorId: req.user.id,
            teacherId: assignment.teacher_id,
            studentId: req.user.id,
            courseId: assignment.course_id,
            assignmentId: assignment.id,
            submissionId,
            assignmentTitle: assignment.title,
            studentName: req.user.username,
            entityType: 'submission',
            entityId: submissionId,
            referenceType: 'submission',
            referenceId: submissionId,
            ...getClientInfo(req)
        });

        res.status(201).json({ message: 'Assignment submitted successfully', submissionId });
    } catch (error) {
        console.error('Assignment submit error:', error);
        res.status(500).json({ error: 'Failed to submit assignment' });
    }
});

// Grade assignment submission (teacher only)
router.patch('/submissions/:submissionId/grade', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { grade } = req.body;
        if (grade === undefined || grade === null || Number.isNaN(Number(grade))) {
            return res.status(400).json({ error: 'grade is required' });
        }

        const [submissions] = await db.query(`
            SELECT s.id, s.student_id, a.id AS assignment_id, a.title AS assignment_title, a.course_id, c.teacher_id
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_no
            JOIN courses c ON c.id = a.course_id
            WHERE s.id = ?
        `, [req.params.submissionId]);

        if (submissions.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const submission = submissions[0];
        if (submission.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to grade this submission' });
        }

        await db.query(
            'UPDATE submissions SET grade = ?, status = \'graded\' WHERE id = ?',
            [Number(grade), req.params.submissionId]
        );

        eventBus.emitDomain(EVENTS.ASSIGNMENT_GRADED, {
            actorId: req.user.id,
            studentId: submission.student_id,
            courseId: submission.course_id,
            assignmentId: submission.assignment_id,
            submissionId: submission.id,
            assignmentTitle: submission.assignment_title,
            grade: Number(grade),
            entityType: 'submission',
            entityId: submission.id,
            referenceType: 'submission',
            referenceId: submission.id,
            ...getClientInfo(req)
        });

        res.json({ message: 'Submission graded successfully' });
    } catch (error) {
        console.error('Assignment grade error:', error);
        res.status(500).json({ error: 'Failed to grade submission' });
    }
});

module.exports = router;