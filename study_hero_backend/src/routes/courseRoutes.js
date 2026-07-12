const express = require('express');
const router = express.Router();

function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

function numericOrNull(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

async function resolveCourseScope(req) {
    const [teachers] = await db.query(`
        SELECT institute_id, department_id, program_id, semester_id, batch_id
        FROM users
        WHERE id = ?
    `, [req.user.id]);
    const teacher = teachers[0] || {};

    return {
        instituteId: numericOrNull(req.body.instituteId) || teacher.institute_id || null,
        departmentId: numericOrNull(req.body.departmentId) || teacher.department_id || null,
        academicYearId: numericOrNull(req.body.academicYearId),
        programId: numericOrNull(req.body.programId) || teacher.program_id || null,
        semesterId: numericOrNull(req.body.semesterId) || teacher.semester_id || null,
        batchId: numericOrNull(req.body.batchId) || teacher.batch_id || null,
        subjectId: numericOrNull(req.body.subjectId)
    };
}
// Get all courses visible to the authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const query = req.user.role === 'teacher'
            ? `
                SELECT c.*, u.username as teacher_name, i.name as institute_name, d.name as department_name, ay.name as academic_year_name, p.name as program_name, s.name as subject_name
                FROM courses c
                JOIN users u ON c.teacher_id = u.id
                LEFT JOIN institutes i ON i.id = c.institute_id
                LEFT JOIN departments d ON d.id = c.department_id
                LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
                LEFT JOIN programs p ON p.id = c.program_id
                LEFT JOIN subjects s ON s.id = c.subject_id
                WHERE c.teacher_id = ?
                ORDER BY c.updated_at DESC, c.created_at DESC
            `
            : `
                SELECT c.*, u.username as teacher_name, i.name as institute_name, d.name as department_name, ay.name as academic_year_name, p.name as program_name, s.name as subject_name
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                JOIN users u ON c.teacher_id = u.id
                LEFT JOIN institutes i ON i.id = c.institute_id
                LEFT JOIN departments d ON d.id = c.department_id
                LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
                LEFT JOIN programs p ON p.id = c.program_id
                LEFT JOIN subjects s ON s.id = c.subject_id
                WHERE e.student_id = ? AND e.status = 'active'
                ORDER BY c.updated_at DESC, c.created_at DESC
            `;

        const [courses] = await db.query(query, [req.user.id]);
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List enrolled students for a teacher-owned course
router.get('/:id/enrollments', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [courses] = await db.query('SELECT id FROM courses WHERE id = ? AND teacher_id = ?', [req.params.id, req.user.id]);
        if (courses.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const [students] = await db.query(`
            SELECT u.id, u.username, u.email, e.status, e.enrollment_date
            FROM enrollments e
            JOIN users u ON u.id = e.student_id
            WHERE e.course_id = ?
            ORDER BY u.username
        `, [req.params.id]);

        res.json(students);
    } catch (error) {
        console.error('Course enrollment list error:', error);
        res.status(500).json({ error: 'Failed to load enrolled students' });
    }
});

// Enroll a student into a teacher-owned course
router.post('/:id/enrollments', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { studentId, email } = req.body;
        const [courses] = await db.query('SELECT id, title FROM courses WHERE id = ? AND teacher_id = ?', [req.params.id, req.user.id]);
        if (courses.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const params = studentId ? [studentId] : [email];
        const lookup = studentId ? 'id = ?' : 'email = ?';
        const [students] = await db.query(`SELECT id, username, email FROM users WHERE role = 'student' AND ${lookup}`, params);
        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = students[0];
        await db.query(`
            INSERT INTO enrollments (student_id, course_id, status)
            VALUES (?, ?, 'active')
            ON DUPLICATE KEY UPDATE status = 'active', enrollment_date = CURRENT_TIMESTAMP
        `, [student.id, req.params.id]);

        eventBus.emitDomain(EVENTS.COURSE_UPDATED, {
            actorId: req.user.id,
            studentId: student.id,
            courseId: Number(req.params.id),
            courseTitle: courses[0].title,
            entityType: 'course',
            entityId: Number(req.params.id),
            referenceType: 'course',
            referenceId: Number(req.params.id),
            activityMetadata: { enrolledStudentId: student.id },
            auditMetadata: { action: 'student_enrolled', studentId: student.id },
            ...getClientInfo(req)
        });

        res.status(201).json({ message: 'Student enrolled successfully', student });
    } catch (error) {
        console.error('Course enrollment error:', error);
        res.status(500).json({ error: 'Failed to enroll student' });
    }
});

// Remove a student from a teacher-owned course
router.delete('/:id/enrollments/:studentId', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [courses] = await db.query('SELECT id, title FROM courses WHERE id = ? AND teacher_id = ?', [req.params.id, req.user.id]);
        if (courses.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const [result] = await db.query('UPDATE enrollments SET status = \'dropped\' WHERE course_id = ? AND student_id = ?', [req.params.id, req.params.studentId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        eventBus.emitDomain(EVENTS.COURSE_UPDATED, {
            actorId: req.user.id,
            studentId: Number(req.params.studentId),
            courseId: Number(req.params.id),
            courseTitle: courses[0].title,
            entityType: 'course',
            entityId: Number(req.params.id),
            referenceType: 'course',
            referenceId: Number(req.params.id),
            auditMetadata: { action: 'student_unenrolled', studentId: Number(req.params.studentId) },
            ...getClientInfo(req)
        });

        res.json({ message: 'Student removed from course' });
    } catch (error) {
        console.error('Course unenrollment error:', error);
        res.status(500).json({ error: 'Failed to remove student from course' });
    }
});
// Get course by ID when the user owns it or is enrolled in it
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const query = req.user.role === 'teacher'
            ? `
                SELECT c.*, u.username as teacher_name, i.name as institute_name, d.name as department_name, ay.name as academic_year_name, p.name as program_name, s.name as subject_name
                FROM courses c
                JOIN users u ON c.teacher_id = u.id
                LEFT JOIN institutes i ON i.id = c.institute_id
                LEFT JOIN departments d ON d.id = c.department_id
                LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
                LEFT JOIN programs p ON p.id = c.program_id
                LEFT JOIN subjects s ON s.id = c.subject_id
                WHERE c.id = ? AND c.teacher_id = ?
            `
            : `
                SELECT c.*, u.username as teacher_name, i.name as institute_name, d.name as department_name, ay.name as academic_year_name, p.name as program_name, s.name as subject_name
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                JOIN users u ON c.teacher_id = u.id
                LEFT JOIN institutes i ON i.id = c.institute_id
                LEFT JOIN departments d ON d.id = c.department_id
                LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
                LEFT JOIN programs p ON p.id = c.program_id
                LEFT JOIN subjects s ON s.id = c.subject_id
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

        const scope = await resolveCourseScope(req);
        const [result] = await db.query(`
            INSERT INTO courses (
                title, description, teacher_id,
                institute_id, department_id, academic_year_id, program_id, semester_id, batch_id, subject_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            title, description || null, req.user.id,
            scope.instituteId, scope.departmentId, scope.academicYearId, scope.programId, scope.semesterId, scope.batchId, scope.subjectId
        ]);

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

