const db = require('../config/db');
const { clamp, json } = require('./performanceService');

function topicFromText(text) {
    return String(text || 'General concept').replace(/\s+/g, ' ').trim().slice(0, 120) || 'General concept';
}

async function detectWeakTopics(studentId, courseId = null) {
    const params = [studentId];
    const courseClause = courseId ? ' AND c.id = ?' : '';
    if (courseId) params.push(Number(courseId));
    const [quizTopics] = await db.query(`
        SELECT c.id course_id, qq.question_text topic, COUNT(*) evidence, SUM(CASE WHEN qaa.is_correct THEN 0 ELSE 1 END) misses
        FROM quiz_attempt_answers qaa
        JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
        JOIN quiz_questions qq ON qq.id = qaa.question_id
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN courses c ON c.id = q.course_id
        WHERE qa.student_id = ? AND qa.status = 'submitted'${courseClause}
        GROUP BY c.id, qq.id, qq.question_text HAVING misses > 0
        ORDER BY misses DESC, evidence DESC LIMIT 20
    `, params);

    const assignmentParams = [studentId];
    if (courseId) assignmentParams.push(Number(courseId));
    const [assignmentTopics] = await db.query(`
        SELECT c.id course_id, a.title topic, COUNT(*) evidence, AVG(COALESCE(s.grade, 0)) gradeAverage
        FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id
        WHERE s.student_id = ? AND s.status = 'graded'${courseClause}
        GROUP BY c.id, a.id, a.title HAVING gradeAverage < 60
        ORDER BY gradeAverage ASC LIMIT 10
    `, assignmentParams);

    const rows = [
        ...quizTopics.map((row) => ({ courseId: row.course_id, topic: topicFromText(row.topic), sourceType: 'quiz', weaknessScore: clamp((Number(row.misses) / Number(row.evidence || 1)) * 100), evidenceCount: row.evidence, metadata: { misses: row.misses } })),
        ...assignmentTopics.map((row) => ({ courseId: row.course_id, topic: topicFromText(row.topic), sourceType: 'assignment', weaknessScore: clamp(100 - Number(row.gradeAverage || 0)), evidenceCount: row.evidence, metadata: { gradeAverage: row.gradeAverage } }))
    ];

    for (const row of rows) {
        await db.query(`
            INSERT INTO weak_topics (student_id, course_id, topic, source_type, weakness_score, evidence_count, metadata, last_detected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE weakness_score = VALUES(weakness_score), evidence_count = VALUES(evidence_count), metadata = VALUES(metadata), last_detected_at = CURRENT_TIMESTAMP, status = 'active'
        `, [studentId, row.courseId || courseId || null, row.topic, row.sourceType, row.weaknessScore, row.evidenceCount, json(row.metadata)]);
    }

    const [persisted] = await db.query('SELECT * FROM weak_topics WHERE student_id = ? AND status = \'active\' ORDER BY weakness_score DESC, last_detected_at DESC LIMIT 25', [studentId]);
    return persisted;
}

module.exports = { detectWeakTopics };
