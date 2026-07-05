const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();
const REPORT_TYPES = new Set(['student', 'course', 'quiz', 'assignment', 'attendance', 'performance']);
const FORMATS = new Set(['json', 'csv', 'pdf', 'excel']);

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (part, total) => total ? Number(((n(part) / n(total)) * 100).toFixed(2)) : 0;
const clamp = (value) => Math.max(0, Math.min(100, n(value)));

async function getCourseIds(user, requestedCourseId = null) {
    const params = [user.id];
    let sql = user.role === 'teacher'
        ? 'SELECT id FROM courses WHERE teacher_id = ?'
        : 'SELECT course_id AS id FROM enrollments WHERE student_id = ? AND status = \'active\'';
    if (requestedCourseId) {
        sql = `SELECT id FROM (${sql}) accessible WHERE id = ?`;
        params.push(Number(requestedCourseId));
    }
    const [rows] = await db.query(sql, params);
    return rows.map((row) => Number(row.id));
}

function filter(alias, ids) {
    if (!ids.length) return { clause: '1=0', params: [] };
    return { clause: `${alias}.id IN (${ids.map(() => '?').join(',')})`, params: ids };
}

async function loadCourseIds(req, res) {
    const ids = await getCourseIds(req.user, req.query.courseId || null);
    if (req.query.courseId && ids.length === 0) {
        res.status(403).json({ error: 'Not authorized for this course' });
        return null;
    }
    return ids;
}

async function teacherPayload(req, courseIds) {
    const f = filter('c', courseIds);
    const [summaryRows] = await db.query(`
        SELECT COUNT(DISTINCT c.id) courses, COUNT(DISTINCT e.student_id) students,
               COUNT(DISTINCT q.id) quizzes, COUNT(DISTINCT a.id) assignments,
               COUNT(DISTINCT qa.id) quizSubmissions, COUNT(DISTINCT s.id) assignmentSubmissions,
               ROUND(AVG(qa.percentage), 2) averageQuizScore, ROUND(AVG(s.grade), 2) averageAssignmentGrade
        FROM courses c
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
        LEFT JOIN quizzes q ON q.course_id = c.id
        LEFT JOIN assignments a ON a.course_id = c.id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
        LEFT JOIN submissions s ON s.assignment_no = a.id
        WHERE ${f.clause}
    `, f.params);

    const [students] = await db.query(`
        SELECT u.id, u.username, u.email, COUNT(DISTINCT e.course_id) enrolledCourses,
               ROUND(AVG(qa.percentage), 2) quizAverage, COUNT(DISTINCT qa.id) submittedQuizzes,
               COUNT(DISTINCT q.id) availableQuizzes, ROUND(AVG(s.grade), 2) assignmentAverage,
               COUNT(DISTINCT s.id) submittedAssignments, COUNT(DISTINCT a.id) availableAssignments,
               MAX(GREATEST(COALESCE(qa.submitted_at, '1970-01-01'), COALESCE(s.submitted_at, '1970-01-01'))) lastActivity
        FROM enrollments e
        JOIN users u ON u.id = e.student_id
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN quizzes q ON q.course_id = c.id AND q.status = 'active'
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = u.id AND qa.status = 'submitted'
        LEFT JOIN assignments a ON a.course_id = c.id AND COALESCE(a.status, 'published') = 'published'
        LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = u.id
        WHERE e.status = 'active' AND ${f.clause}
        GROUP BY u.id, u.username, u.email
        ORDER BY quizAverage ASC, assignmentAverage ASC, u.username ASC
    `, f.params);

    const [quizzes] = await db.query(`
        SELECT q.id, q.title, c.title courseTitle, q.status, COUNT(DISTINCT e.student_id) enrolledStudents,
               COUNT(DISTINCT qa.id) attempts, ROUND(AVG(qa.percentage), 2) averageScore,
               ROUND(MIN(qa.percentage), 2) lowestScore, ROUND(MAX(qa.percentage), 2) highestScore
        FROM quizzes q JOIN courses c ON c.id = q.course_id
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
        WHERE ${f.clause}
        GROUP BY q.id, q.title, c.title, q.status ORDER BY q.created_at DESC LIMIT 100
    `, f.params);

    const [assignments] = await db.query(`
        SELECT a.id, a.title, c.title courseTitle, a.status, COUNT(DISTINCT e.student_id) enrolledStudents,
               COUNT(DISTINCT s.id) submissions, COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN s.id END) gradedSubmissions,
               ROUND(AVG(s.grade), 2) averageGrade
        FROM assignments a JOIN courses c ON c.id = a.course_id
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
        LEFT JOIN submissions s ON s.assignment_no = a.id
        WHERE ${f.clause}
        GROUP BY a.id, a.title, c.title, a.status ORDER BY a.created_at DESC LIMIT 100
    `, f.params);
    const [courses] = await db.query(`
        SELECT c.id, c.title, COUNT(DISTINCT e.student_id) students, COUNT(DISTINCT q.id) quizzes,
               COUNT(DISTINCT a.id) assignments, ROUND(AVG(qa.percentage), 2) averageQuizScore,
               ROUND(AVG(s.grade), 2) averageAssignmentGrade, COUNT(DISTINCT ae.id) activityEvents
        FROM courses c
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
        LEFT JOIN quizzes q ON q.course_id = c.id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
        LEFT JOIN assignments a ON a.course_id = c.id
        LEFT JOIN submissions s ON s.assignment_no = a.id
        LEFT JOIN activity_events ae ON ae.course_id = c.id
        WHERE ${f.clause}
        GROUP BY c.id, c.title ORDER BY c.updated_at DESC
    `, f.params);

    const [weekly] = await db.query(`
        SELECT DATE_FORMAT(day, '%Y-%m-%d') label, SUM(quiz) quizSubmissions, SUM(assignment) assignmentSubmissions, SUM(activity) activityEvents
        FROM (
            SELECT DATE(qa.submitted_at) day, COUNT(*) quiz, 0 assignment, 0 activity
            FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
            WHERE qa.status = 'submitted' AND qa.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AND ${f.clause}
            GROUP BY DATE(qa.submitted_at)
            UNION ALL
            SELECT DATE(s.submitted_at), 0, COUNT(*), 0
            FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
            WHERE s.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AND ${f.clause}
            GROUP BY DATE(s.submitted_at)
            UNION ALL
            SELECT DATE(ae.created_at), 0, 0, COUNT(*)
            FROM activity_events ae JOIN courses c ON c.id = ae.course_id
            WHERE ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AND ${f.clause}
            GROUP BY DATE(ae.created_at)
        ) x GROUP BY day ORDER BY day ASC
    `, [...f.params, ...f.params, ...f.params]);

    const [monthly] = await db.query(`
        SELECT DATE_FORMAT(month, '%Y-%m') label, SUM(quiz) quizSubmissions, SUM(assignment) assignmentSubmissions, SUM(activity) activityEvents
        FROM (
            SELECT DATE_FORMAT(qa.submitted_at, '%Y-%m-01') month, COUNT(*) quiz, 0 assignment, 0 activity
            FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
            WHERE qa.status = 'submitted' AND qa.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) AND ${f.clause}
            GROUP BY DATE_FORMAT(qa.submitted_at, '%Y-%m-01')
            UNION ALL
            SELECT DATE_FORMAT(s.submitted_at, '%Y-%m-01'), 0, COUNT(*), 0
            FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
            WHERE s.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) AND ${f.clause}
            GROUP BY DATE_FORMAT(s.submitted_at, '%Y-%m-01')
            UNION ALL
            SELECT DATE_FORMAT(ae.created_at, '%Y-%m-01'), 0, 0, COUNT(*)
            FROM activity_events ae JOIN courses c ON c.id = ae.course_id
            WHERE ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) AND ${f.clause}
            GROUP BY DATE_FORMAT(ae.created_at, '%Y-%m-01')
        ) x GROUP BY month ORDER BY month ASC
    `, [...f.params, ...f.params, ...f.params]);

    const [aiUsage] = await db.query(`
        SELECT feature, provider, COUNT(*) requests, SUM(total_tokens) tokens, ROUND(AVG(latency_ms), 0) averageLatency, SUM(estimated_cost) estimatedCost
        FROM ai_usage_logs
        WHERE user_id = ? OR user_id IN (SELECT DISTINCT e.student_id FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE ${f.clause})
        GROUP BY feature, provider ORDER BY requests DESC
    `, [req.user.id, ...f.params]);

    const atRiskStudents = students.map((student) => {
        const assignmentCompletion = pct(student.submittedAssignments, student.availableAssignments);
        const quizCompletion = pct(student.submittedQuizzes, student.availableQuizzes);
        const riskScore = clamp(100 - ((n(student.quizAverage) * 0.45) + (assignmentCompletion * 0.35) + (quizCompletion * 0.2)));
        return { ...student, assignmentCompletion, quizCompletion, riskScore, riskLevel: riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low' };
    }).filter((student) => student.riskLevel !== 'low');

    return {
        role: 'teacher',
        summary: summaryRows[0] || {},
        studentPerformance: students.map((student) => ({ ...student, assignmentCompletion: pct(student.submittedAssignments, student.availableAssignments), quizCompletion: pct(student.submittedQuizzes, student.availableQuizzes) })),
        quizAnalytics: quizzes.map((quiz) => ({ ...quiz, completionRate: pct(quiz.attempts, quiz.enrolledStudents) })),
        assignmentAnalytics: assignments.map((assignment) => ({ ...assignment, submissionRate: pct(assignment.submissions, assignment.enrolledStudents), gradingRate: pct(assignment.gradedSubmissions, assignment.submissions) })),
        courseAnalytics: courses,
        charts: { weekly, monthly },
        atRiskStudents,
        aiAnalytics: { usage: aiUsage },
        generatedAt: new Date().toISOString()
    };
}

async function studentPayload(req, courseIds) {
    const f = filter('c', courseIds);
    const [summaryRows] = await db.query(`
        SELECT COUNT(DISTINCT e.course_id) courses, COUNT(DISTINCT q.id) availableQuizzes,
               COUNT(DISTINCT qa.id) completedQuizzes, ROUND(AVG(qa.percentage), 2) quizAccuracy,
               COUNT(DISTINCT a.id) availableAssignments, COUNT(DISTINCT s.id) submittedAssignments,
               ROUND(AVG(s.grade), 2) assignmentAverage, COUNT(DISTINCT ae.id) activityEvents
        FROM enrollments e JOIN courses c ON c.id = e.course_id
        LEFT JOIN quizzes q ON q.course_id = c.id AND q.status = 'active'
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = e.student_id AND qa.status = 'submitted'
        LEFT JOIN assignments a ON a.course_id = c.id AND COALESCE(a.status, 'published') = 'published'
        LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = e.student_id
        LEFT JOIN activity_events ae ON ae.course_id = c.id AND (ae.actor_id = e.student_id OR ae.target_user_id = e.student_id)
        WHERE e.student_id = ? AND e.status = 'active' AND ${f.clause}
    `, [req.user.id, ...f.params]);

    const [gameRows] = await db.query('SELECT xp, daily_streak, weekly_streak, last_activity_date FROM user_gamification WHERE user_id = ?', [req.user.id]);
    const [attempts] = await db.query(`
        SELECT qa.id, qa.percentage, qa.score, qa.total_questions, qa.submitted_at, q.title, c.title courseTitle
        FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
        WHERE qa.student_id = ? AND qa.status = 'submitted' AND ${f.clause}
        ORDER BY qa.submitted_at DESC LIMIT 20
    `, [req.user.id, ...f.params]);

    const [assignments] = await db.query(`
        SELECT s.id, s.grade, s.status, s.submitted_at, a.title, c.title courseTitle
        FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
        WHERE s.student_id = ? AND ${f.clause}
        ORDER BY s.submitted_at DESC LIMIT 20
    `, [req.user.id, ...f.params]);

    const [weak] = await db.query(`
        SELECT LEFT(qq.question_text, 90) topic, SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) correct,
               SUM(CASE WHEN qaa.is_correct THEN 0 ELSE 1 END) incorrect, COUNT(*) attempts
        FROM quiz_attempt_answers qaa
        JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
        JOIN quiz_questions qq ON qq.id = qaa.question_id
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN courses c ON c.id = q.course_id
        WHERE qa.student_id = ? AND qa.status = 'submitted' AND ${f.clause}
        GROUP BY qq.id, qq.question_text HAVING incorrect > 0 ORDER BY incorrect DESC, attempts DESC LIMIT 8
    `, [req.user.id, ...f.params]);

    const [strong] = await db.query(`
        SELECT LEFT(qq.question_text, 90) topic, SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) correct, COUNT(*) attempts
        FROM quiz_attempt_answers qaa
        JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
        JOIN quiz_questions qq ON qq.id = qaa.question_id
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN courses c ON c.id = q.course_id
        WHERE qa.student_id = ? AND qa.status = 'submitted' AND ${f.clause}
        GROUP BY qq.id, qq.question_text HAVING correct > 0 ORDER BY correct DESC, attempts DESC LIMIT 8
    `, [req.user.id, ...f.params]);

    const [weekly] = await db.query(`
        SELECT DATE_FORMAT(day, '%Y-%m-%d') label, SUM(points) points, SUM(minutes) studyMinutes
        FROM (
            SELECT DATE(qa.submitted_at) day, COUNT(*) * 20 points, COALESCE(SUM(TIMESTAMPDIFF(MINUTE, qa.started_at, qa.submitted_at)), 0) minutes
            FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
            WHERE qa.student_id = ? AND qa.status = 'submitted' AND qa.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AND ${f.clause}
            GROUP BY DATE(qa.submitted_at)
            UNION ALL
            SELECT DATE(s.submitted_at), COUNT(*) * 15, COUNT(*) * 20
            FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
            WHERE s.student_id = ? AND s.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AND ${f.clause}
            GROUP BY DATE(s.submitted_at)
            UNION ALL
            SELECT DATE(ae.created_at), COUNT(*) * 5, COUNT(*) * 5
            FROM activity_events ae JOIN courses c ON c.id = ae.course_id
            WHERE (ae.actor_id = ? OR ae.target_user_id = ?) AND ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AND ${f.clause}
            GROUP BY DATE(ae.created_at)
        ) x GROUP BY day ORDER BY day ASC
    `, [req.user.id, ...f.params, req.user.id, ...f.params, req.user.id, req.user.id, ...f.params]);

    const [monthly] = await db.query(`
        SELECT DATE_FORMAT(month, '%Y-%m') label, SUM(points) points, SUM(minutes) studyMinutes
        FROM (
            SELECT DATE_FORMAT(qa.submitted_at, '%Y-%m-01') month, COUNT(*) * 20 points, COALESCE(SUM(TIMESTAMPDIFF(MINUTE, qa.started_at, qa.submitted_at)), 0) minutes
            FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
            WHERE qa.student_id = ? AND qa.status = 'submitted' AND qa.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) AND ${f.clause}
            GROUP BY DATE_FORMAT(qa.submitted_at, '%Y-%m-01')
            UNION ALL
            SELECT DATE_FORMAT(s.submitted_at, '%Y-%m-01'), COUNT(*) * 15, COUNT(*) * 20
            FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
            WHERE s.student_id = ? AND s.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) AND ${f.clause}
            GROUP BY DATE_FORMAT(s.submitted_at, '%Y-%m-01')
            UNION ALL
            SELECT DATE_FORMAT(ae.created_at, '%Y-%m-01'), COUNT(*) * 5, COUNT(*) * 5
            FROM activity_events ae JOIN courses c ON c.id = ae.course_id
            WHERE (ae.actor_id = ? OR ae.target_user_id = ?) AND ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) AND ${f.clause}
            GROUP BY DATE_FORMAT(ae.created_at, '%Y-%m-01')
        ) x GROUP BY month ORDER BY month ASC
    `, [req.user.id, ...f.params, req.user.id, ...f.params, req.user.id, req.user.id, ...f.params]);

    const [recommendations] = await db.query('SELECT id, title, recommendation, priority, status, created_at FROM ai_recommendations WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [req.user.id]);
    const [artifacts] = await db.query('SELECT type, COUNT(*) count, MAX(created_at) latest FROM ai_artifacts WHERE user_id = ? GROUP BY type ORDER BY latest DESC', [req.user.id]);
    const [rankRows] = await db.query(`
        SELECT ranked.* FROM (
            SELECT u.id user_id, u.username, COALESCE(g.xp, 0) xp, COALESCE(g.daily_streak, 0) daily_streak,
                   ROW_NUMBER() OVER (ORDER BY COALESCE(g.xp, 0) DESC, u.username ASC) leaderboardRank
            FROM users u LEFT JOIN user_gamification g ON g.user_id = u.id WHERE u.role = 'student'
        ) ranked WHERE ranked.user_id = ?
    `, [req.user.id]);

    const summary = summaryRows[0] || {};
    const assignmentCompletion = pct(summary.submittedAssignments, summary.availableAssignments);
    const studyMinutes = weekly.reduce((total, row) => total + n(row.studyMinutes), 0);
    const readinessScore = Math.round(clamp((n(summary.quizAccuracy) * 0.45) + (assignmentCompletion * 0.3) + (clamp(n(summary.activityEvents) * 4) * 0.15) + (n(gameRows[0]?.daily_streak) * 2)));

    return {
        role: 'student',
        summary: { ...summary, assignmentCompletion, studyMinutes, readinessScore, xp: n(gameRows[0]?.xp), learningStreak: n(gameRows[0]?.daily_streak), weeklyStreak: n(gameRows[0]?.weekly_streak) },
        recentAttempts: attempts,
        recentAssignments: assignments,
        charts: { weekly, monthly },
        topics: { weak, strong },
        aiAnalytics: {
            recommendations,
            artifacts,
            suggestions: weak.slice(0, 3).map((topic) => `Review: ${topic.topic}`),
            examReadiness: readinessScore >= 80 ? 'ready' : readinessScore >= 60 ? 'developing' : 'needs_focus',
            insights: [`Quiz accuracy is ${n(summary.quizAccuracy)}%.`, `Assignment completion is ${assignmentCompletion}%.`, `Study time this week is ${studyMinutes} minutes.`]
        },
        leaderboard: rankRows[0] || null,
        generatedAt: new Date().toISOString()
    };
}

async function leaderboardPayload(req, courseIds) {
    const f = filter('c', courseIds);
    const scope = ['weekly', 'monthly', 'all-time'].includes(req.query.scope) ? req.query.scope : 'all-time';
    const dateClause = scope === 'weekly' ? 'AND ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)' : scope === 'monthly' ? 'AND ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)' : '';
    const [rows] = await db.query(`
        SELECT u.id user_id, u.username,
               COALESCE(g.xp, 0) + COUNT(DISTINCT qa.id) * 20 + COUNT(DISTINCT s.id) * 15 + COUNT(DISTINCT ae.id) * 5 xp,
               FLOOR((COALESCE(g.xp, 0) + COUNT(DISTINCT qa.id) * 20 + COUNT(DISTINCT s.id) * 15 + COUNT(DISTINCT ae.id) * 5) / 100) + 1 level,
               COALESCE(g.daily_streak, 0) streak, COUNT(DISTINCT ach.id) badges, ROUND(AVG(qa.percentage), 2) averageScore
        FROM enrollments e JOIN users u ON u.id = e.student_id JOIN courses c ON c.id = e.course_id
        LEFT JOIN user_gamification g ON g.user_id = u.id
        LEFT JOIN quizzes q ON q.course_id = c.id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = u.id AND qa.status = 'submitted'
        LEFT JOIN assignments a ON a.course_id = c.id
        LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = u.id
        LEFT JOIN activity_events ae ON ae.course_id = c.id AND (ae.actor_id = u.id OR ae.target_user_id = u.id) ${dateClause}
        LEFT JOIN achievements ach ON ach.user_id = u.id AND (ach.course_id IS NULL OR ach.course_id = c.id)
        WHERE e.status = 'active' AND ${f.clause}
        GROUP BY u.id, u.username, g.xp, g.daily_streak ORDER BY xp DESC, averageScore DESC, u.username ASC LIMIT 50
    `, f.params);
    return rows.map((row, index) => ({ ...row, rank: index + 1, scope }));
}
async function reportRows(req, type, courseIds) {
    const f = filter('c', courseIds);
    if (type === 'student') {
        const params = req.user.role === 'student' ? [req.user.id, ...f.params] : f.params;
        const [rows] = await db.query(`
            SELECT u.id, u.username, u.email, c.title course, e.status,
                   ROUND(AVG(qa.percentage), 2) quizAverage, COUNT(DISTINCT s.id) submittedAssignments, ROUND(AVG(s.grade), 2) assignmentAverage
            FROM enrollments e JOIN users u ON u.id = e.student_id JOIN courses c ON c.id = e.course_id
            LEFT JOIN quizzes q ON q.course_id = c.id
            LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = u.id AND qa.status = 'submitted'
            LEFT JOIN assignments a ON a.course_id = c.id
            LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = u.id
            WHERE ${req.user.role === 'student' ? 'u.id = ? AND ' : ''}${f.clause}
            GROUP BY u.id, u.username, u.email, c.title, e.status ORDER BY c.title, u.username
        `, params);
        return rows;
    }
    if (type === 'course') {
        const [rows] = await db.query(`
            SELECT c.id, c.title, COUNT(DISTINCT e.student_id) students, COUNT(DISTINCT q.id) quizzes, COUNT(DISTINCT a.id) assignments, ROUND(AVG(qa.percentage), 2) averageQuizScore
            FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
            LEFT JOIN quizzes q ON q.course_id = c.id LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
            LEFT JOIN assignments a ON a.course_id = c.id WHERE ${f.clause}
            GROUP BY c.id, c.title ORDER BY c.title
        `, f.params);
        return rows;
    }
    if (type === 'quiz') {
        const [rows] = await db.query(`
            SELECT q.id, q.title, c.title course, q.status, COUNT(DISTINCT qa.id) attempts, ROUND(AVG(qa.percentage), 2) averageScore
            FROM quizzes q JOIN courses c ON c.id = q.course_id LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
            WHERE ${f.clause} GROUP BY q.id, q.title, c.title, q.status ORDER BY q.created_at DESC
        `, f.params);
        return rows;
    }
    if (type === 'assignment') {
        const [rows] = await db.query(`
            SELECT a.id, a.title, c.title course, a.status, COUNT(DISTINCT s.id) submissions, ROUND(AVG(s.grade), 2) averageGrade
            FROM assignments a JOIN courses c ON c.id = a.course_id LEFT JOIN submissions s ON s.assignment_no = a.id
            WHERE ${f.clause} GROUP BY a.id, a.title, c.title, a.status ORDER BY a.created_at DESC
        `, f.params);
        return rows;
    }
    if (type === 'attendance') {
        const [rows] = await db.query(`
            SELECT c.title course, ats.title session, ats.session_date, ar.status, COUNT(ar.id) records
            FROM attendance_sessions ats JOIN courses c ON c.id = ats.course_id LEFT JOIN attendance_records ar ON ar.session_id = ats.id
            WHERE ${f.clause} GROUP BY c.title, ats.title, ats.session_date, ar.status ORDER BY ats.session_date DESC
        `, f.params);
        return rows;
    }
    const params = req.user.role === 'student' ? [req.user.id, ...f.params] : f.params;
    const [rows] = await db.query(`
        SELECT c.title course, u.username student, ge.source_type, ge.title, ge.score, ge.max_score, ge.graded_at
        FROM gradebook_entries ge JOIN courses c ON c.id = ge.course_id JOIN users u ON u.id = ge.student_id
        WHERE ${req.user.role === 'student' ? 'ge.student_id = ? AND ' : ''}${f.clause}
        ORDER BY ge.graded_at DESC
    `, params);
    return rows;
}

function normalizeRows(rows) {
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])));
}

function csv(rows) {
    const flat = normalizeRows(rows);
    if (flat.length === 0) return 'message\nNo records available\n';
    const headers = Array.from(new Set(flat.flatMap((row) => Object.keys(row))));
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...flat.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

function excel(title, rows) {
    const flat = normalizeRows(rows);
    const headers = flat.length ? Array.from(new Set(flat.flatMap((row) => Object.keys(row)))) : ['message'];
    const displayRows = flat.length ? flat : [{ message: 'No records available' }];
    const cell = (value) => String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><table><caption>${cell(title)}</caption><thead><tr>${headers.map((header) => `<th>${cell(header)}</th>`).join('')}</tr></thead><tbody>${displayRows.map((row) => `<tr>${headers.map((header) => `<td>${cell(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
function pdf(title, rows) {
    const lines = [title, `Generated: ${new Date().toISOString()}`, '', ...csv(rows).split('\n').slice(0, 60)];
    const stream = ['BT /F1 10 Tf 40 760 Td', ...lines.map((line, index) => `${index ? '0 -14 Td ' : ''}(${String(line).replace(/[\\()]/g, ' ').slice(0, 95)}) Tj`), 'ET'].join('\n');
    const objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
        '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
        `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`
    ];
    let out = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) { offsets.push(Buffer.byteLength(out)); out += `${object}\n`; }
    const xref = Buffer.byteLength(out);
    out += 'xref\n0 6\n0000000000 65535 f \n';
    for (let index = 1; index <= 5; index++) out += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    out += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, 'latin1');
}

router.get('/teacher', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher analytics only' });
        const courseIds = await loadCourseIds(req, res);
        if (!courseIds) return;
        res.json(await teacherPayload(req, courseIds));
    } catch (error) {
        console.error('Teacher analytics error:', error);
        res.status(500).json({ error: 'Failed to load teacher analytics' });
    }
});

router.get('/student', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student analytics only' });
        const courseIds = await loadCourseIds(req, res);
        if (!courseIds) return;
        res.json(await studentPayload(req, courseIds));
    } catch (error) {
        console.error('Student analytics error:', error);
        res.status(500).json({ error: 'Failed to load student analytics' });
    }
});

router.get('/leaderboards', authMiddleware, async (req, res) => {
    try {
        const courseIds = await loadCourseIds(req, res);
        if (!courseIds) return;
        res.json(await leaderboardPayload(req, courseIds));
    } catch (error) {
        console.error('Leaderboard analytics error:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

router.get('/reports/:type/export', authMiddleware, async (req, res) => {
    try {
        const type = String(req.params.type || '').toLowerCase();
        const format = String(req.query.format || 'csv').toLowerCase();
        if (!REPORT_TYPES.has(type)) return res.status(400).json({ error: 'Unsupported report type' });
        if (!FORMATS.has(format)) return res.status(400).json({ error: 'Unsupported export format' });
        const courseIds = await loadCourseIds(req, res);
        if (!courseIds) return;
        const rows = await reportRows(req, type, courseIds);
        const title = `${type} analytics report`;
        await db.query('INSERT INTO reports (user_id, course_id, type, title, format, payload) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, req.query.courseId || null, type, title, format, JSON.stringify({ rows: rows.length, generatedAt: new Date().toISOString() })]);
        if (format === 'json') return res.json({ title, rows, generatedAt: new Date().toISOString() });
        if (format === 'excel') {
            res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="study-hero-${type}-report.xls"`);
            return res.send(excel(title, rows));
        }
        if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="study-hero-${type}-report.pdf"`);
            return res.send(pdf(title, rows));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="study-hero-${type}-report.csv"`);
        return res.send(csv(rows));
    } catch (error) {
        console.error('Report export error:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});

module.exports = router;




