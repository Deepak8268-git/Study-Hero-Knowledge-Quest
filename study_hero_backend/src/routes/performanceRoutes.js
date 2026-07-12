const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/authMiddleware');
const performanceService = require('../services/performanceService');
const predictionService = require('../services/predictionService');
const weakTopicService = require('../services/weakTopicService');
const recommendationService = require('../services/recommendationService');
const studyPlannerService = require('../services/studyPlannerService');
const streakService = require('../services/streakService');
const insightsService = require('../services/insightsService');

const router = express.Router();
const FORMATS = new Set(['json', 'csv', 'pdf', 'excel']);

function handleError(res, error, fallback) {
    console.error(fallback, error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : fallback });
}

function normalizeRows(rows) {
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])));
}

function csv(rows) {
    const flat = normalizeRows(rows);
    if (!flat.length) return 'message\nNo records available\n';
    const headers = Array.from(new Set(flat.flatMap((row) => Object.keys(row))));
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...flat.map((row) => headers.map((header) => escape(typeof row[header] === 'object' ? JSON.stringify(row[header]) : row[header])).join(','))].join('\n');
}

function excel(title, rows) {
    const flat = normalizeRows(rows);
    const headers = flat.length ? Array.from(new Set(flat.flatMap((row) => Object.keys(row)))) : ['message'];
    const displayRows = flat.length ? flat : [{ message: 'No records available' }];
    const cell = (value) => String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><table><caption>${cell(title)}</caption><thead><tr>${headers.map((header) => `<th>${cell(header)}</th>`).join('')}</tr></thead><tbody>${displayRows.map((row) => `<tr>${headers.map((header) => `<td>${cell(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

function pdf(title, rows) {
    const lines = [title, `Generated: ${new Date().toISOString()}`, '', ...csv(rows).split('\n').slice(0, 65)];
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

async function buildStudentIntelligence(req) {
    const profile = await performanceService.getStudentPerformance(req.user, req.query.courseId || null);
    const weakTopics = await weakTopicService.detectWeakTopics(req.user.id, req.query.courseId || null);
    const prediction = await predictionService.persistPrediction(profile, await predictionService.predictExamReadiness(profile));
    const recommendations = await recommendationService.generateRecommendations({ profile, weakTopics, prediction, actorId: req.user.id });
    const streak = await streakService.computeLearningStreak(req.user.id);
    const comparison = await insightsService.getStudentComparison(req.user.id, req.query.courseId || null);
    return { profile, weakTopics, prediction, recommendations: recommendations.recommendations, streak, comparison, generatedAt: new Date().toISOString() };
}

router.get('/student', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student performance only' });
        res.json(await buildStudentIntelligence(req));
    } catch (error) { handleError(res, error, 'Failed to load student performance intelligence'); }
});

router.get('/teacher', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher performance only' });
        res.json(await insightsService.getTeacherInsights(req.user.id, req.query.courseId || null));
    } catch (error) { handleError(res, error, 'Failed to load teacher AI insights'); }
});

router.get('/prediction', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student prediction only' });
        const profile = await performanceService.getStudentPerformance(req.user, req.query.courseId || null);
        res.json(await predictionService.persistPrediction(profile, await predictionService.predictExamReadiness(profile)));
    } catch (error) { handleError(res, error, 'Failed to predict exam readiness'); }
});

router.get('/weak-topics', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student weak topics only' });
        res.json(await weakTopicService.detectWeakTopics(req.user.id, req.query.courseId || null));
    } catch (error) { handleError(res, error, 'Failed to detect weak topics'); }
});

router.get('/recommendations', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student recommendations only' });
        res.json(await recommendationService.listRecommendations(req.user.id, req.query.status || null));
    } catch (error) { handleError(res, error, 'Failed to load recommendations'); }
});

router.patch('/recommendations/:id/status', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student recommendations only' });
        const status = ['active', 'completed', 'dismissed'].includes(req.body.status) ? req.body.status : null;
        if (!status) return res.status(400).json({ error: 'Invalid status' });
        const updated = await recommendationService.updateRecommendationStatus(req.user.id, req.params.id, status);
        if (!updated) return res.status(404).json({ error: 'Recommendation not found' });
        res.json({ message: 'Recommendation updated' });
    } catch (error) { handleError(res, error, 'Failed to update recommendation'); }
});

router.get('/study-plans', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student study plans only' });
        res.json(await studyPlannerService.listStudyPlans(req.user.id));
    } catch (error) { handleError(res, error, 'Failed to load study plans'); }
});

router.post('/study-plans', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ error: 'Student study plans only' });
        const profile = await performanceService.getStudentPerformance(req.user, req.body.courseId || null);
        const weakTopics = await weakTopicService.detectWeakTopics(req.user.id, req.body.courseId || null);
        const prediction = await predictionService.predictExamReadiness(profile);
        const plan = await studyPlannerService.generateStudyPlan({ studentId: req.user.id, courseId: req.body.courseId || null, planType: req.body.planType || 'weekly', examDate: req.body.examDate || null, weakTopics, prediction });
        res.status(201).json(plan);
    } catch (error) { handleError(res, error, 'Failed to generate study plan'); }
});

router.get('/history', authMiddleware, async (req, res) => {
    try {
        const studentId = req.user.role === 'student' ? req.user.id : Number(req.query.studentId);
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });
        res.json(await performanceService.getPerformanceHistory(studentId, req.query.courseId || null));
    } catch (error) { handleError(res, error, 'Failed to load performance history'); }
});

router.get('/reports/export', authMiddleware, async (req, res) => {
    try {
        const format = String(req.query.format || 'json').toLowerCase();
        if (!FORMATS.has(format)) return res.status(400).json({ error: 'Unsupported format' });
        const payload = req.user.role === 'teacher' ? await insightsService.getTeacherInsights(req.user.id, req.query.courseId || null) : await buildStudentIntelligence(req);
        const rows = Array.isArray(payload.learningTrends) ? payload.learningTrends : [payload.profile?.summary || payload];
        const title = 'AI performance intelligence report';
        await db.query('INSERT INTO reports (user_id, course_id, type, title, format, payload) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, req.query.courseId || null, 'performance', title, format, JSON.stringify({ generatedAt: new Date().toISOString() })]);
        if (format === 'json') return res.json({ title, payload });
        if (format === 'excel') { res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="study-hero-ai-performance.xls"'); return res.send(excel(title, rows)); }
        if (format === 'pdf') { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename="study-hero-ai-performance.pdf"'); return res.send(pdf(title, rows)); }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="study-hero-ai-performance.csv"'); return res.send(csv(rows));
    } catch (error) { handleError(res, error, 'Failed to export performance report'); }
});

module.exports = router;
