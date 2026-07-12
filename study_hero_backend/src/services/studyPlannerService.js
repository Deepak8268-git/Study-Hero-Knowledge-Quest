const db = require('../config/db');
const { json, n } = require('./performanceService');

function distributeTopics(weakTopics, days) {
    const topics = weakTopics.length ? weakTopics : [{ topic: 'Review current course material', weakness_score: 50 }];
    return Array.from({ length: days }, (_, index) => {
        const topic = topics[index % topics.length];
        return { day: index + 1, topic: topic.topic, activity: index % 3 === 0 ? 'Practice questions' : index % 3 === 1 ? 'Review notes' : 'Attempt quiz', minutes: Number(topic.weakness_score || 50) >= 70 ? 60 : 40 };
    });
}

async function generateStudyPlan({ studentId, courseId = null, planType = 'weekly', examDate = null, weakTopics = [], prediction = null }) {
    const days = planType === 'daily' ? 1 : planType === 'monthly' ? 30 : 7;
    const recommendedHours = prediction ? Math.max(n(prediction.recommendedStudyHours), days * 0.75) : days * 1;
    const plan = { examDate, recommendedHours, sessions: distributeTopics(weakTopics, days), generatedAt: new Date().toISOString() };
    const [result] = await db.query(`
        INSERT INTO study_plans (student_id, course_id, title, plan_type, exam_date, recommended_hours, plan_json, generated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'system')
    `, [studentId, courseId, `${planType[0].toUpperCase()}${planType.slice(1)} AI Study Plan`, planType, examDate || null, recommendedHours, json(plan)]);
    return { id: result.insertId, ...plan, planType };
}

async function listStudyPlans(studentId) {
    const [rows] = await db.query('SELECT * FROM study_plans WHERE student_id = ? ORDER BY created_at DESC LIMIT 50', [studentId]);
    return rows;
}

module.exports = { generateStudyPlan, listStudyPlans };
