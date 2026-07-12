const db = require('../config/db');
const { clamp, pct, n } = require('./performanceService');

async function getTeacherInsights(teacherId, courseId = null) {
    const params = [teacherId];
    const courseClause = courseId ? ' AND c.id = ?' : '';
    if (courseId) params.push(Number(courseId));
    const [students] = await db.query(`
        SELECT u.id, u.username, u.email, COUNT(DISTINCT e.course_id) courses,
               ROUND(AVG(qa.percentage), 2) quizAverage,
               ROUND(AVG(s.grade), 2) assignmentAverage,
               COUNT(DISTINCT qa.id) quizAttempts,
               COUNT(DISTINCT s.id) assignmentSubmissions,
               COUNT(DISTINCT ae.id) activityEvents,
               MAX(GREATEST(COALESCE(qa.submitted_at, '1970-01-01'), COALESCE(s.submitted_at, '1970-01-01'), COALESCE(ae.created_at, '1970-01-01'))) lastActivity
        FROM enrollments e JOIN users u ON u.id = e.student_id JOIN courses c ON c.id = e.course_id
        LEFT JOIN quizzes q ON q.course_id = c.id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = u.id AND qa.status = 'submitted'
        LEFT JOIN assignments a ON a.course_id = c.id
        LEFT JOIN submissions s ON s.assignment_no = a.id AND s.student_id = u.id
        LEFT JOIN activity_events ae ON ae.course_id = c.id AND (ae.actor_id = u.id OR ae.target_user_id = u.id)
        WHERE c.teacher_id = ? AND e.status = 'active'${courseClause}
        GROUP BY u.id, u.username, u.email ORDER BY quizAverage DESC, assignmentAverage DESC
    `, params);
    const enriched = students.map((student) => {
        const score = clamp((n(student.quizAverage) * 0.45) + (n(student.assignmentAverage) * 0.35) + Math.min(n(student.activityEvents) * 4, 20));
        return { ...student, performanceScore: score, riskLevel: score < 40 ? 'critical' : score < 60 ? 'high' : score < 75 ? 'medium' : 'low' };
    });
    const [weakTopics] = await db.query(`
        SELECT wt.topic, COUNT(*) affectedStudents, ROUND(AVG(wt.weakness_score), 2) averageWeakness
        FROM weak_topics wt JOIN courses c ON c.id = wt.course_id
        WHERE c.teacher_id = ? AND wt.status = 'active'${courseClause}
        GROUP BY wt.topic ORDER BY affectedStudents DESC, averageWeakness DESC LIMIT 12
    `, params);
    const classAverage = enriched.length ? Math.round(enriched.reduce((sum, row) => sum + n(row.performanceScore), 0) / enriched.length) : 0;
    const atRiskStudents = enriched.filter((student) => student.riskLevel !== 'low');
    const topPerformers = enriched.filter((student) => student.performanceScore >= 75).slice(0, 10);
    const suggestedRemedialQuizzes = weakTopics.slice(0, 5).map((topic) => ({ topic: topic.topic, reason: `${topic.affectedStudents} students affected`, suggestedQuestions: topic.averageWeakness >= 70 ? 15 : 10 }));
    const insights = [];
    if (atRiskStudents.length) insights.push(`${atRiskStudents.length} students need intervention based on current performance signals.`);
    if (weakTopics.length) insights.push(`Most common weak area: ${weakTopics[0].topic}.`);
    if (classAverage >= 75) insights.push('Class performance is healthy; use extension tasks for top performers.');
    return { classAverage, atRiskStudents, topPerformers, weakTopics, suggestedRemedialQuizzes, learningTrends: enriched, insights };
}

async function getStudentComparison(studentId, courseId = null) {
    const params = [];
    let scopeJoin = '';
    let scopeWhere = '';
    if (courseId) { scopeJoin = 'JOIN enrollments e ON e.student_id = sp.student_id'; scopeWhere = 'WHERE e.course_id = ? AND e.status = \'active\''; params.push(Number(courseId)); }
    const [rows] = await db.query(`
        SELECT ranked.* FROM (
            SELECT sp.student_id, u.username, sp.overall_score,
                   ROW_NUMBER() OVER (ORDER BY sp.overall_score DESC, u.username ASC) rankPosition,
                   COUNT(*) OVER () totalStudents,
                   PERCENT_RANK() OVER (ORDER BY sp.overall_score ASC) percentileValue
            FROM student_performance sp JOIN users u ON u.id = sp.student_id ${scopeJoin} ${scopeWhere}
        ) ranked WHERE ranked.student_id = ?
    `, [...params, studentId]);
    const row = rows[0] || null;
    if (!row) return null;
    return { ...row, percentile: Math.round(n(row.percentileValue) * 100), leaderboardPosition: row.rankPosition, improvement: 0 };
}

module.exports = { getTeacherInsights, getStudentComparison };
