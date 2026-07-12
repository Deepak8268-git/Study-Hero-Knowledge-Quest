const db = require('../config/db');
const { clamp, n, json } = require('./performanceService');

async function predictExamReadiness(profile) {
    const s = profile.summary;
    const probabilityOfPassing = clamp((n(s.overallScore) * 0.55) + (n(s.quizAccuracy) * 0.25) + (n(s.assignmentCompletion) * 0.1) + (n(s.learningConsistency) * 0.1));
    const estimatedMarks = clamp((n(s.quizAccuracy) * 0.5) + (n(s.assignmentQuality) * 0.3) + (n(s.attendanceContribution) * 0.1) + (n(s.learningConsistency) * 0.1));
    const evidence = n(s.completedQuizzes) + n(s.submittedAssignments) + n(s.activityEvents);
    const confidenceScore = clamp(35 + Math.min(evidence * 8, 45) + (n(s.availableQuizzes) > 0 ? 10 : 0) + (n(s.availableAssignments) > 0 ? 10 : 0));
    const riskLevel = probabilityOfPassing < 40 ? 'critical' : probabilityOfPassing < 60 ? 'high' : probabilityOfPassing < 75 ? 'medium' : 'low';
    const recommendedStudyHours = Number((Math.max(0, 85 - probabilityOfPassing) / 8 + Math.max(0, 70 - n(s.learningConsistency)) / 15).toFixed(1));
    return { probabilityOfPassing, estimatedMarks, confidenceScore, riskLevel, recommendedStudyHours, factors: s, modelVersion: 'deterministic-v1' };
}

async function persistPrediction(profile, prediction) {
    const [result] = await db.query(`
        INSERT INTO prediction_history (student_id, course_id, probability_of_passing, estimated_marks, confidence_score, risk_level, recommended_study_hours, model_version, factors)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [profile.studentId, profile.courseId, prediction.probabilityOfPassing, prediction.estimatedMarks, prediction.confidenceScore, prediction.riskLevel, prediction.recommendedStudyHours, prediction.modelVersion, json(prediction.factors)]);
    return { ...prediction, id: result.insertId };
}

module.exports = { predictExamReadiness, persistPrediction };
