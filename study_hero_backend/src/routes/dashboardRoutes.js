const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');

router.get('/teacher', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const teacherId = req.user.id;

        const [courses] = await db.query(`
            SELECT
                c.id,
                c.title,
                c.description,
                c.created_at,
                c.updated_at,
                COUNT(DISTINCT e.student_id) AS students
            FROM courses c
            LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
            WHERE c.teacher_id = ?
            GROUP BY c.id
            ORDER BY c.updated_at DESC, c.created_at DESC
        `, [teacherId]);

        const [students] = await db.query(`
            SELECT
                u.id,
                u.username AS name,
                u.email,
                COUNT(DISTINCT e.course_id) AS enrolled_courses,
                COALESCE(ROUND(AVG(qa.percentage), 0), 0) AS progress
            FROM users u
            JOIN enrollments e ON e.student_id = u.id AND e.status = 'active'
            JOIN courses c ON c.id = e.course_id
            LEFT JOIN quiz_attempts qa ON qa.student_id = u.id AND qa.status = 'submitted'
            WHERE c.teacher_id = ? AND u.role = 'student'
            GROUP BY u.id
            ORDER BY u.username
        `, [teacherId]);

        const [assignments] = await db.query(`
            SELECT
                a.id,
                a.title,
                a.description,
                a.due_date,
                c.title AS course,
                COUNT(DISTINCT s.id) AS submissions,
                COUNT(DISTINCT e.student_id) AS totalStudents
            FROM assignments a
            JOIN courses c ON c.id = a.course_id
            LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
            LEFT JOIN submissions s ON s.assignment_no = a.id
            WHERE c.teacher_id = ?
            GROUP BY a.id
            ORDER BY a.due_date ASC, a.created_at DESC
        `, [teacherId]);

        const [quizzes] = await db.query(`
            SELECT
                q.id,
                COALESCE(q.title, CONCAT('Quiz #', q.id)) AS title,
                q.description,
                q.quiz_code AS code,
                q.status,
                q.scheduled_date AS scheduledDate,
                q.duration_minutes AS duration,
                q.passing_score AS passingScore,
                q.source,
                q.created_at AS createdAt,
                c.title AS courseName,
                COUNT(DISTINCT qq.id) AS questionCount,
                COUNT(DISTINCT qa.id) AS attemptCount
            FROM quizzes q
            JOIN courses c ON c.id = q.course_id
            LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
            LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
            WHERE q.teacher_id = ?
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `, [teacherId]);

        const [recentActivity] = await db.query(`
            SELECT id, entity_type, entity_id, action, metadata, created_at
            FROM activity_events
            WHERE actor_id = ? OR course_id IN (SELECT id FROM courses WHERE teacher_id = ?)
            ORDER BY created_at DESC
            LIMIT 10
        `, [teacherId, teacherId]);

        res.json({
            courses,
            students: students.map((student) => ({
                ...student,
                avatar: String(student.name || 'S').slice(0, 2).toUpperCase()
            })),
            assignments,
            quizzes,
            recentActivity,
            stats: {
                activeCourses: courses.length,
                totalStudents: students.length,
                activeAssignments: assignments.length,
                activeQuizzes: quizzes.filter((quiz) => quiz.status === 'active').length
            }
        });
    } catch (error) {
        console.error('Teacher dashboard error:', error);
        res.status(500).json({ error: 'Failed to load teacher dashboard' });
    }
});

router.get('/student', authMiddleware, async (req, res) => {
    try {
        const studentId = req.user.id;

        const [courses] = await db.query(`
            SELECT
                c.id,
                c.title,
                u.username AS instructor,
                COALESCE(ROUND(AVG(qa.percentage), 0), 0) AS progress,
                c.created_at,
                c.updated_at
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            JOIN users u ON u.id = c.teacher_id
            LEFT JOIN quiz_attempts qa ON qa.student_id = e.student_id AND qa.status = 'submitted'
            WHERE e.student_id = ? AND e.status = 'active'
            GROUP BY c.id
            ORDER BY c.updated_at DESC, c.created_at DESC
        `, [studentId]);

        const [assignments] = await db.query(`
            SELECT
                a.id,
                a.title,
                c.title AS course,
                a.due_date AS dueDate,
                CASE WHEN s.id IS NULL THEN false ELSE true END AS completed,
                s.grade
            FROM enrollments e
            JOIN assignments a ON a.course_id = e.course_id
            JOIN courses c ON c.id = a.course_id
            LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = e.student_id
            WHERE e.student_id = ? AND e.status = 'active'
            ORDER BY a.due_date ASC, a.created_at DESC
        `, [studentId]);

        const [scheduledQuizzes] = await db.query(`
            SELECT
                q.id,
                COALESCE(q.title, CONCAT('Quiz #', q.id)) AS title,
                q.description,
                q.scheduled_date AS scheduledDate,
                q.duration_minutes AS duration,
                q.quiz_code AS quizCode,
                q.source,
                c.id AS courseId,
                c.title AS courseName,
                COUNT(qq.id) AS questionCount
            FROM enrollments e
            JOIN quizzes q ON q.course_id = e.course_id
            JOIN courses c ON c.id = q.course_id
            LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
            WHERE e.student_id = ? AND e.status = 'active' AND q.status = 'active'
            GROUP BY q.id
            ORDER BY q.scheduled_date ASC, q.created_at DESC
        `, [studentId]);

        const [quizHistory] = await db.query(`
            SELECT
                qa.id,
                qa.quiz_id AS quizId,
                COALESCE(q.title, CONCAT('Quiz #', q.id)) AS title,
                qa.score,
                qa.total_questions AS totalQuestions,
                qa.percentage,
                qa.submitted_at AS submittedAt,
                c.title AS courseName
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            JOIN courses c ON c.id = q.course_id
            WHERE qa.student_id = ? AND qa.status = 'submitted'
            ORDER BY qa.submitted_at DESC
        `, [studentId]);

        const averageQuizScore = quizHistory.length
            ? Math.round(quizHistory.reduce((sum, attempt) => sum + Number(attempt.percentage || 0), 0) / quizHistory.length)
            : 0;

        res.json({
            courses,
            assignments,
            scheduledQuizzes,
            quizHistory,
            grades: assignments.filter((assignment) => assignment.grade !== null),
            performance: {
                averageQuizScore,
                completedAssignments: assignments.filter((assignment) => assignment.completed).length,
                pendingAssignments: assignments.filter((assignment) => !assignment.completed).length,
                completedQuizzes: quizHistory.length
            },
            stats: {
                enrolledCourses: courses.length,
                pendingAssignments: assignments.filter((assignment) => !assignment.completed).length,
                upcomingQuizzes: scheduledQuizzes.length,
                averageQuizScore
            }
        });
    } catch (error) {
        console.error('Student dashboard error:', error);
        res.status(500).json({ error: 'Failed to load student dashboard' });
    }
});

module.exports = router;
