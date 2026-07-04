const db = require('../config/db');
const providerRegistry = require('./providerRegistry');
const usageService = require('./usageService');
const prompts = require('./promptTemplates');

function safeJson(value) {
    return value === undefined ? null : JSON.stringify(value);
}

async function runAiOperation({ user, feature, promptMessages, metadata = {}, provider, model }) {
    const promptText = promptMessages.map((message) => message.content).join('\n');
    const estimatedTokens = providerRegistry.estimateTokens(promptText) + 1000;
    await usageService.assertQuota(user.id, estimatedTokens);

    try {
        const result = await providerRegistry.complete(promptMessages, { provider, model });
        const usageId = await usageService.logUsage({
            userId: user.id,
            feature,
            provider: result.provider,
            model: model || process.env.AI_MODEL || null,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs: result.latencyMs,
            status: 'success'
        });
        return { ...result, usageId };
    } catch (error) {
        await usageService.logUsage({
            userId: user.id,
            feature,
            provider: provider || providerRegistry.configuredProvider(),
            model: model || process.env.AI_MODEL || null,
            inputTokens: providerRegistry.estimateTokens(promptText),
            outputTokens: 0,
            status: 'failure',
            errorMessage: error.message
        });
        throw error;
    }
}

async function createConversation({ user, title = 'AI Study Session', mode = 'assistant', courseId = null }) {
    const [result] = await db.query(`
        INSERT INTO ai_conversations (user_id, course_id, title, mode)
        VALUES (?, ?, ?, ?)
    `, [user.id, courseId, title, mode]);
    return result.insertId;
}

async function addConversationMessage({ conversationId, role, content, metadata = null }) {
    const [result] = await db.query(`
        INSERT INTO ai_conversation_messages (conversation_id, role, content, metadata)
        VALUES (?, ?, ?, ?)
    `, [conversationId, role, content, safeJson(metadata)]);
    return result.insertId;
}

async function chat({ user, conversationId, message, courseId = null, mode = 'assistant', documentText = null }) {
    const activeConversationId = conversationId || await createConversation({ user, mode, courseId, title: message.slice(0, 80) || 'AI Study Session' });
    await addConversationMessage({ conversationId: activeConversationId, role: 'user', content: message });
    const promptMessages = mode === 'pdf_chat'
        ? prompts.pdfChat({ question: message, documentText: documentText || '' })
        : prompts.assistant({ message });
    const result = await runAiOperation({ user, feature: mode, promptMessages });
    await addConversationMessage({ conversationId: activeConversationId, role: 'assistant', content: result.text, metadata: { provider: result.provider, usageId: result.usageId } });
    return { conversationId: activeConversationId, response: result.text, provider: result.provider, usageId: result.usageId };
}

async function storeArtifact({ user, type, title, content, courseId = null, sourceType = null, sourceId = null, metadata = null }) {
    const [result] = await db.query(`
        INSERT INTO ai_artifacts (user_id, course_id, type, title, content, source_type, source_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [user.id, courseId, type, title, content, sourceType, sourceId, safeJson(metadata)]);
    return result.insertId;
}

async function generateArtifact({ user, type, payload, courseId = null }) {
    const promptMap = {
        quiz: prompts.quiz,
        assignment: prompts.assignment,
        study_plan: prompts.planner,
        flashcards: prompts.flashcards,
        summary: prompts.summary,
        doubt_solution: prompts.doubt,
        recommendations: prompts.recommendations,
        weak_topics: prompts.weakTopics
    };
    const promptBuilder = promptMap[type];
    if (!promptBuilder) throw new Error(`Unsupported AI artifact type: ${type}`);
    const result = await runAiOperation({ user, feature: type, promptMessages: promptBuilder(payload) });
    const title = payload.title || type.replace(/_/g, ' ');
    const artifactId = await storeArtifact({
        user,
        type,
        title,
        content: result.text,
        courseId,
        sourceType: payload.sourceType || null,
        sourceId: payload.sourceId || null,
        metadata: { provider: result.provider, usageId: result.usageId, request: payload }
    });
    return { artifactId, title, content: result.text, provider: result.provider, usageId: result.usageId };
}

async function ingestDocument({ user, courseId = null, file }) {
    const originalName = file.originalname || 'uploaded-document.pdf';
    const text = file.text || '';
    const [docResult] = await db.query(`
        INSERT INTO ai_documents (user_id, course_id, title, original_name, mime_type, size_bytes, status)
        VALUES (?, ?, ?, ?, ?, ?, 'processed')
    `, [user.id, courseId, originalName, originalName, file.mimetype || null, file.size || 0]);

    const chunks = String(text).match(/[\s\S]{1,2000}/g) || [];
    for (let index = 0; index < chunks.length; index++) {
        await db.query(`
            INSERT INTO ai_document_chunks (document_id, chunk_index, content, embedding_provider, embedding_status)
            VALUES (?, ?, ?, ?, 'pending')
        `, [docResult.insertId, index, chunks[index], process.env.AI_EMBEDDING_PROVIDER || 'pending']);
    }

    return { documentId: docResult.insertId, chunks: chunks.length };
}

async function getDocumentText(userId, documentId) {
    const [docs] = await db.query('SELECT id FROM ai_documents WHERE id = ? AND user_id = ?', [documentId, userId]);
    if (docs.length === 0) return null;
    const [chunks] = await db.query('SELECT content FROM ai_document_chunks WHERE document_id = ? ORDER BY chunk_index ASC', [documentId]);
    return chunks.map((chunk) => chunk.content).join('\n');
}

async function buildPerformanceProfile(user) {
    const [attempts] = await db.query(`
        SELECT qa.percentage, q.title, c.title AS course_title
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN courses c ON c.id = q.course_id
        WHERE qa.student_id = ? AND qa.status = 'submitted'
        ORDER BY qa.submitted_at DESC
        LIMIT 20
    `, [user.id]);
    const [assignments] = await db.query(`
        SELECT a.title, c.title AS course_title, s.grade, s.status
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_no
        JOIN courses c ON c.id = a.course_id
        WHERE s.student_id = ?
        ORDER BY s.submitted_at DESC
        LIMIT 20
    `, [user.id]);
    return { attempts, assignments };
}

module.exports = {
    createConversation,
    addConversationMessage,
    chat,
    generateArtifact,
    ingestDocument,
    getDocumentText,
    buildPerformanceProfile,
    runAiOperation
};