const db = require('../config/db');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');
const { json, n } = require('./performanceService');

async function createRecommendation({ studentId, courseId = null, type, title, description, priority = 'NORMAL', referenceType = null, referenceId = null, metadata = null, actorId = null }) {
    const [result] = await db.query(`
        INSERT INTO recommendations (student_id, course_id, type, title, description, priority, reference_type, reference_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [studentId, courseId, type, title, description, priority, referenceType, referenceId, json(metadata)]);
    if (priority === 'HIGH' || priority === 'CRITICAL') {
        eventBus.emitDomain(EVENTS.PERFORMANCE_ALERT, {
            actorId: actorId || studentId,
            studentId,
            courseId,
            alertTitle: title,
            alertMessage: description,
            priority,
            referenceType: referenceType || 'recommendation',
            referenceId: result.insertId,
            entityType: 'recommendation',
            entityId: result.insertId,
            activityMetadata: { type, priority }
        });
    }
    return result.insertId;
}

async function generateRecommendations({ profile, weakTopics = [], prediction = null, actorId = null }) {
    const created = [];
    const existingTitles = new Set();
    const [existing] = await db.query('SELECT title FROM recommendations WHERE student_id = ? AND status = \'active\' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)', [profile.studentId]);
    existing.forEach((row) => existingTitles.add(row.title));
    const add = async (rec) => {
        if (existingTitles.has(rec.title)) return;
        existingTitles.add(rec.title);
        created.push(await createRecommendation({ ...rec, studentId: profile.studentId, actorId }));
    };

    for (const topic of weakTopics.slice(0, 5)) {
        await add({ courseId: topic.course_id || profile.courseId, type: 'practice_topic', title: `Practice ${topic.topic}`, description: `Spend focused practice time on ${topic.topic}.`, priority: Number(topic.weakness_score) >= 70 ? 'HIGH' : 'NORMAL', referenceType: 'weak_topic', referenceId: topic.id, metadata: { weaknessScore: topic.weakness_score } });
    }
    if (n(profile.summary.assignmentCompletion) < 70) {
        await add({ courseId: profile.courseId, type: 'complete_assignment', title: 'Complete pending assignments', description: 'Assignment completion is below target. Finish pending work before attempting new practice.', priority: 'HIGH', metadata: { assignmentCompletion: profile.summary.assignmentCompletion } });
    }
    if (n(profile.summary.quizAccuracy) < 65) {
        await add({ courseId: profile.courseId, type: 'attempt_quiz', title: 'Attempt a revision quiz', description: 'Quiz accuracy indicates more retrieval practice is needed.', priority: 'NORMAL', metadata: { quizAccuracy: profile.summary.quizAccuracy } });
    }
    if (prediction && ['high', 'critical'].includes(prediction.riskLevel)) {
        await add({ courseId: profile.courseId, type: 'study_plan', title: 'Follow a structured study plan', description: `Exam risk is ${prediction.riskLevel}. Recommended study time: ${prediction.recommendedStudyHours} hours.`, priority: prediction.riskLevel === 'critical' ? 'CRITICAL' : 'HIGH', metadata: prediction });
    }

    const [rows] = await db.query('SELECT * FROM recommendations WHERE student_id = ? ORDER BY created_at DESC LIMIT 30', [profile.studentId]);
    return { created, recommendations: rows };
}

async function listRecommendations(studentId, status = null) {
    const params = [studentId];
    let where = 'student_id = ?';
    if (status) { where += ' AND status = ?'; params.push(status); }
    const [rows] = await db.query(`SELECT * FROM recommendations WHERE ${where} ORDER BY FIELD(priority, 'CRITICAL', 'HIGH', 'NORMAL', 'LOW'), created_at DESC LIMIT 100`, params);
    return rows;
}

async function updateRecommendationStatus(studentId, id, status) {
    const [result] = await db.query('UPDATE recommendations SET status = ? WHERE id = ? AND student_id = ?', [status, id, studentId]);
    return result.affectedRows > 0;
}

module.exports = { createRecommendation, generateRecommendations, listRecommendations, updateRecommendationStatus };
