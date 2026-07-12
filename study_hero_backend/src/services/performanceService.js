const db = require('../config/db');
const aiService = require('../ai/aiService');

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value) => Math.max(0, Math.min(100, n(value)));
const pct = (part, total) => total ? Number(((n(part) / n(total)) * 100).toFixed(2)) : 0;
const json = (value) => JSON.stringify(value ?? null);

function courseFilter(courseId, alias = 'c') {
    return courseId ? { clause: ` AND ${alias}.id = ?`, params: [Number(courseId)] } : { clause: '', params: [] };
}

async function getAccessibleCourseIds(user, courseId = null) {
    const params = [user.id];
    let sql = user.role === 'teacher'
        ? 'SELECT id FROM courses WHERE teacher_id = ?'
        : 'SELECT course_id AS id FROM enrollments WHERE student_id = ? AND status = \'active\'';
    if (courseId) {
        sql = `SELECT id FROM (${sql}) allowed WHERE id = ?`;
        params.push(Number(courseId));
    }
    const [rows] = await db.query(sql, params);
    return rows.map((row) => Number(row.id));
}

async function collectStudentMetrics(studentId, courseId = null) {
    const f = courseFilter(courseId);
    const [summaryRows] = await db.query(`
        SELECT COUNT(DISTINCT e.course_id) courses,
               COUNT(DISTINCT q.id) availableQuizzes,
               COUNT(DISTINCT qa.id) completedQuizzes,
               ROUND(AVG(qa.percentage), 2) quizAccuracy,
               COUNT(DISTINCT a.id) availableAssignments,
               COUNT(DISTINCT s.id) submittedAssignments,
               ROUND(AVG(s.grade), 2) assignmentQuality,
               COUNT(DISTINCT ats.id) attendanceSessions,
               SUM(CASE WHEN ar.status IN ('present','late','excused') THEN 1 ELSE 0 END) attendedSessions,
               COUNT(DISTINCT ae.id) activityEvents,
               MAX(GREATEST(COALESCE(qa.submitted_at, '1970-01-01'), COALESCE(s.submitted_at, '1970-01-01'), COALESCE(ae.created_at, '1970-01-01'))) lastActivity
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN quizzes q ON q.course_id = c.id AND q.status = 'active'
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = e.student_id AND qa.status = 'submitted'
        LEFT JOIN assignments a ON a.course_id = c.id AND COALESCE(a.status, 'published') = 'published'
        LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = e.student_id
        LEFT JOIN attendance_sessions ats ON ats.course_id = c.id
        LEFT JOIN attendance_records ar ON ar.session_id = ats.id AND ar.student_id = e.student_id
        LEFT JOIN activity_events ae ON ae.course_id = c.id AND (ae.actor_id = e.student_id OR ae.target_user_id = e.student_id)
        WHERE e.student_id = ? AND e.status = 'active'${f.clause}
    `, [studentId, ...f.params]);

    const [weeklyRows] = await db.query(`
        SELECT DATE_FORMAT(day, '%Y-%m-%d') label, SUM(points) points, SUM(minutes) studyMinutes
        FROM (
            SELECT DATE(qa.submitted_at) day, COUNT(*) * 20 points, COALESCE(SUM(TIMESTAMPDIFF(MINUTE, qa.started_at, qa.submitted_at)), 0) minutes
            FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
            WHERE qa.student_id = ? AND qa.status = 'submitted' AND qa.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)${f.clause}
            GROUP BY DATE(qa.submitted_at)
            UNION ALL
            SELECT DATE(s.submitted_at), COUNT(*) * 15, COUNT(*) * 20
            FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
            WHERE s.student_id = ? AND s.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)${f.clause}
            GROUP BY DATE(s.submitted_at)
            UNION ALL
            SELECT DATE(ae.created_at), COUNT(*) * 5, COUNT(*) * 5
            FROM activity_events ae JOIN courses c ON c.id = ae.course_id
            WHERE (ae.actor_id = ? OR ae.target_user_id = ?) AND ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)${f.clause}
            GROUP BY DATE(ae.created_at)
        ) x GROUP BY day ORDER BY day ASC
    `, [studentId, ...f.params, studentId, ...f.params, studentId, studentId, ...f.params]);

    const [monthlyRows] = await db.query(`
        SELECT DATE_FORMAT(month, '%Y-%m') label, SUM(points) points, SUM(minutes) studyMinutes
        FROM (
            SELECT DATE_FORMAT(qa.submitted_at, '%Y-%m-01') month, COUNT(*) * 20 points, COALESCE(SUM(TIMESTAMPDIFF(MINUTE, qa.started_at, qa.submitted_at)), 0) minutes
            FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN courses c ON c.id = q.course_id
            WHERE qa.student_id = ? AND qa.status = 'submitted' AND qa.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH)${f.clause}
            GROUP BY DATE_FORMAT(qa.submitted_at, '%Y-%m-01')
            UNION ALL
            SELECT DATE_FORMAT(s.submitted_at, '%Y-%m-01'), COUNT(*) * 15, COUNT(*) * 20
            FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
            WHERE s.student_id = ? AND s.submitted_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH)${f.clause}
            GROUP BY DATE_FORMAT(s.submitted_at, '%Y-%m-01')
            UNION ALL
            SELECT DATE_FORMAT(ae.created_at, '%Y-%m-01'), COUNT(*) * 5, COUNT(*) * 5
            FROM activity_events ae JOIN courses c ON c.id = ae.course_id
            WHERE (ae.actor_id = ? OR ae.target_user_id = ?) AND ae.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH)${f.clause}
            GROUP BY DATE_FORMAT(ae.created_at, '%Y-%m-01')
        ) x GROUP BY month ORDER BY month ASC
    `, [studentId, ...f.params, studentId, ...f.params, studentId, studentId, ...f.params]);

    const summary = summaryRows[0] || {};
    const assignmentCompletion = pct(summary.submittedAssignments, summary.availableAssignments);
    const quizCompletion = pct(summary.completedQuizzes, summary.availableQuizzes);
    const attendanceContribution = pct(summary.attendedSessions, summary.attendanceSessions);
    const activeDays = weeklyRows.filter((row) => n(row.points) > 0).length;
    const learningConsistency = clamp((activeDays / 7) * 100 + Math.min(n(summary.activityEvents) * 2, 20));
    const quizAccuracy = clamp(summary.quizAccuracy);
    const assignmentQuality = clamp(summary.assignmentQuality || assignmentCompletion);
    const overallScore = Math.round(clamp((quizAccuracy * 0.35) + (assignmentQuality * 0.25) + (assignmentCompletion * 0.15) + (attendanceContribution * 0.1) + (learningConsistency * 0.15)));

    const strengths = [];
    const weaknesses = [];
    if (quizAccuracy >= 75) strengths.push('Quiz accuracy'); else weaknesses.push('Quiz accuracy');
    if (assignmentQuality >= 75) strengths.push('Assignment quality'); else weaknesses.push('Assignment quality');
    if (learningConsistency >= 65) strengths.push('Learning consistency'); else weaknesses.push('Learning consistency');
    if (attendanceContribution >= 75) strengths.push('Attendance'); else if (n(summary.attendanceSessions) > 0) weaknesses.push('Attendance');

    return {
        studentId,
        courseId: courseId ? Number(courseId) : null,
        summary: { ...summary, assignmentCompletion, quizCompletion, attendanceContribution, learningConsistency, quizAccuracy, assignmentQuality, overallScore },
        strengths,
        weaknesses,
        charts: { weekly: weeklyRows, monthly: monthlyRows }
    };
}

async function buildPerformanceSummary(user, profile) {
    const fallback = `Overall score ${profile.summary.overallScore}%. Strengths: ${profile.strengths.join(', ') || 'building foundational activity'}. Focus areas: ${profile.weaknesses.join(', ') || 'maintain current momentum'}.`;
    try {
        const result = await aiService.runAiOperation({
            user,
            feature: 'performance_coach',
            promptMessages: [
                { role: 'system', content: 'You are an academic performance coach. Be concise and actionable.' },
                { role: 'user', content: `Create a short performance coaching summary from this real Study Hero profile: ${JSON.stringify(profile.summary)}` }
            ]
        });
        return result.text || fallback;
    } catch (error) {
        return fallback;
    }
}

async function persistPerformance(user, profile, summaryText) {
    await db.query(`
        INSERT INTO student_performance (student_id, course_id, overall_score, quiz_accuracy, assignment_quality, attendance_contribution, learning_consistency, performance_summary, strengths, weaknesses, last_calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE overall_score = VALUES(overall_score), quiz_accuracy = VALUES(quiz_accuracy), assignment_quality = VALUES(assignment_quality), attendance_contribution = VALUES(attendance_contribution), learning_consistency = VALUES(learning_consistency), performance_summary = VALUES(performance_summary), strengths = VALUES(strengths), weaknesses = VALUES(weaknesses), last_calculated_at = CURRENT_TIMESTAMP
    `, [profile.studentId, profile.courseId, profile.summary.overallScore, profile.summary.quizAccuracy, profile.summary.assignmentQuality, profile.summary.attendanceContribution, profile.summary.learningConsistency, summaryText, json(profile.strengths), json(profile.weaknesses)]);

    const today = new Date().toISOString().slice(0, 10);
    await db.query(`
        INSERT INTO performance_history (student_id, course_id, period_type, period_start, overall_score, quiz_accuracy, assignment_quality, attendance_contribution, learning_consistency, metadata)
        VALUES (?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE overall_score = VALUES(overall_score), quiz_accuracy = VALUES(quiz_accuracy), assignment_quality = VALUES(assignment_quality), attendance_contribution = VALUES(attendance_contribution), learning_consistency = VALUES(learning_consistency), metadata = VALUES(metadata)
    `, [profile.studentId, profile.courseId, today, profile.summary.overallScore, profile.summary.quizAccuracy, profile.summary.assignmentQuality, profile.summary.attendanceContribution, profile.summary.learningConsistency, json({ strengths: profile.strengths, weaknesses: profile.weaknesses })]);

    await db.query('INSERT INTO performance_snapshots (student_id, course_id, snapshot_type, payload) VALUES (?, ?, ?, ?)', [profile.studentId, profile.courseId, 'automatic', json({ summary: profile.summary, charts: profile.charts })]);
}

async function getStudentPerformance(user, courseId = null) {
    const allowed = await getAccessibleCourseIds(user, courseId);
    if (courseId && allowed.length === 0) {
        const error = new Error('Not authorized for this course');
        error.statusCode = 403;
        throw error;
    }
    const profile = await collectStudentMetrics(user.id, courseId || null);
    const summaryText = await buildPerformanceSummary(user, profile);
    await persistPerformance(user, profile, summaryText);
    return { ...profile, performanceSummary: summaryText };
}

async function getPerformanceHistory(studentId, courseId = null) {
    const params = [studentId];
    let where = 'student_id = ?';
    if (courseId) { where += ' AND course_id = ?'; params.push(Number(courseId)); }
    const [rows] = await db.query(`SELECT * FROM performance_history WHERE ${where} ORDER BY period_start DESC LIMIT 90`, params);
    return rows;
}

module.exports = { n, clamp, pct, json, getAccessibleCourseIds, collectStudentMetrics, getStudentPerformance, getPerformanceHistory };
