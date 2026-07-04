const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const aiService = require('../ai/aiService');
const usageService = require('../ai/usageService');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

function getClientInfo(req) {
    return { ipAddress: req.ip || req.connection?.remoteAddress || null, userAgent: req.get('user-agent') || null };
}

async function canAccessCourse(user, courseId) {
    if (!courseId) return true;
    if (user.role === 'teacher') {
        const [rows] = await db.query('SELECT id FROM courses WHERE id = ? AND teacher_id = ?', [courseId, user.id]);
        return rows.length > 0;
    }
    const [rows] = await db.query('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = \'active\'', [courseId, user.id]);
    return rows.length > 0;
}

async function requireCourseAccess(req, res, courseId) {
    const allowed = await canAccessCourse(req.user, courseId);
    if (!allowed) {
        res.status(403).json({ error: 'Not authorized for this course' });
        return false;
    }
    return true;
}

function emitAiEvent(req, feature, entityId, metadata = {}) {
    eventBus.emitDomain(EVENTS.AI_OPERATION_COMPLETED, {
        actorId: req.user.id,
        userId: req.user.id,
        entityType: 'ai',
        entityId,
        referenceType: 'ai',
        referenceId: entityId,
        activityMetadata: { feature, ...metadata },
        auditMetadata: { feature, ...metadata },
        ...getClientInfo(req)
    });
}

router.get('/usage', authMiddleware, async (req, res) => {
    try {
        res.json(await usageService.getUsageWindow(req.user.id));
    } catch (error) {
        res.status(500).json({ error: 'Failed to load AI usage' });
    }
});

router.get('/conversations', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', [req.user.id]);
    res.json(rows);
});

router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
    const [conversations] = await db.query('SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (conversations.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    const [messages] = await db.query('SELECT * FROM ai_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json(messages);
});

router.post('/assistant/chat', authMiddleware, async (req, res) => {
    try {
        const { conversationId, message, courseId } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.chat({ user: req.user, conversationId, message, courseId, mode: 'assistant' });
        emitAiEvent(req, 'assistant', result.conversationId, { conversationId: result.conversationId });
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI assistant failed' });
    }
});

router.post('/documents/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'PDF file is required' });
        const courseId = req.body.courseId ? Number(req.body.courseId) : null;
        if (!await requireCourseAccess(req, res, courseId)) return;
        const parsed = await pdfParse(req.file.buffer);
        const result = await aiService.ingestDocument({ user: req.user, courseId, file: { ...req.file, text: parsed.text || '' } });
        emitAiEvent(req, 'pdf_ingested', result.documentId, { courseId, chunks: result.chunks });
        res.status(201).json(result);
    } catch (error) {
        console.error('AI document upload error:', error);
        res.status(500).json({ error: 'Failed to process PDF' });
    }
});

router.post('/documents/:documentId/chat', authMiddleware, async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });
        const documentText = await aiService.getDocumentText(req.user.id, req.params.documentId);
        if (documentText === null) return res.status(404).json({ error: 'Document not found' });
        const result = await aiService.chat({ user: req.user, conversationId, message, mode: 'pdf_chat', documentText });
        emitAiEvent(req, 'pdf_chat', result.conversationId, { documentId: Number(req.params.documentId) });
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'PDF chat failed' });
    }
});

router.post('/generate/quiz', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { courseId, context, difficulty, bloomLevel, questionTypes, count, title } = req.body;
        if (!context || !courseId) return res.status(400).json({ error: 'courseId and context are required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.generateArtifact({ user: req.user, type: 'quiz', courseId, payload: { context, difficulty, bloomLevel, questionTypes, count, title } });
        emitAiEvent(req, 'quiz', result.artifactId, { courseId });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI quiz generation failed' });
    }
});

router.post('/generate/assignment', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { courseId, context, difficulty, title } = req.body;
        if (!context || !courseId) return res.status(400).json({ error: 'courseId and context are required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.generateArtifact({ user: req.user, type: 'assignment', courseId, payload: { context, difficulty, title } });
        emitAiEvent(req, 'assignment', result.artifactId, { courseId });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI assignment generation failed' });
    }
});

router.post('/generate/flashcards', authMiddleware, async (req, res) => {
    try {
        const { courseId, context, count, title } = req.body;
        if (!context) return res.status(400).json({ error: 'context is required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.generateArtifact({ user: req.user, type: 'flashcards', courseId, payload: { context, count, title } });
        emitAiEvent(req, 'flashcards', result.artifactId, { courseId });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI flashcard generation failed' });
    }
});

router.post('/generate/summary', authMiddleware, async (req, res) => {
    try {
        const { courseId, context, title } = req.body;
        if (!context) return res.status(400).json({ error: 'context is required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.generateArtifact({ user: req.user, type: 'summary', courseId, payload: { context, title } });
        emitAiEvent(req, 'summary', result.artifactId, { courseId });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI summary generation failed' });
    }
});

router.post('/planner', authMiddleware, async (req, res) => {
    try {
        const { goals, availability, deadline, courseId, title } = req.body;
        if (!goals) return res.status(400).json({ error: 'goals are required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.generateArtifact({ user: req.user, type: 'study_plan', courseId, payload: { goals, availability, deadline, title } });
        emitAiEvent(req, 'study_plan', result.artifactId, { courseId });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI study planner failed' });
    }
});

router.post('/doubt-solver', authMiddleware, async (req, res) => {
    try {
        const { question, context, courseId, title } = req.body;
        if (!question) return res.status(400).json({ error: 'question is required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const result = await aiService.generateArtifact({ user: req.user, type: 'doubt_solution', courseId, payload: { question, context, title } });
        emitAiEvent(req, 'doubt_solution', result.artifactId, { courseId });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI doubt solver failed' });
    }
});

router.post('/weak-topics', authMiddleware, async (req, res) => {
    try {
        const performance = await aiService.buildPerformanceProfile(req.user);
        const result = await aiService.generateArtifact({ user: req.user, type: 'weak_topics', payload: { performance, title: 'Weak Topic Analysis' } });
        emitAiEvent(req, 'weak_topics', result.artifactId);
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Weak topic detection failed' });
    }
});

router.post('/recommendations', authMiddleware, async (req, res) => {
    try {
        const learnerProfile = await aiService.buildPerformanceProfile(req.user);
        const result = await aiService.generateArtifact({ user: req.user, type: 'recommendations', payload: { learnerProfile, title: 'Learning Recommendations' } });
        await db.query('INSERT INTO ai_recommendations (user_id, title, recommendation, metadata) VALUES (?, ?, ?, ?)', [req.user.id, result.title, result.content, JSON.stringify({ artifactId: result.artifactId })]);
        emitAiEvent(req, 'recommendations', result.artifactId);
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'AI recommendations failed' });
    }
});

router.get('/artifacts', authMiddleware, async (req, res) => {
    const params = [req.user.id];
    let where = 'user_id = ?';
    if (req.query.type) {
        where += ' AND type = ?';
        params.push(req.query.type);
    }
    const [rows] = await db.query(`SELECT * FROM ai_artifacts WHERE ${where} ORDER BY created_at DESC LIMIT 50`, params);
    res.json(rows);
});

module.exports = router;