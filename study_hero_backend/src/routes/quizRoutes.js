const express = require('express');
const axios = require('axios');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

function generateQuizCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeSettings(settings = {}) {
    return {
        timeLimit: Number(settings.timeLimit || settings.duration || 20),
        preventTabSwitch: settings.preventTabSwitch !== false,
        randomizeQuestions: settings.randomizeQuestions !== false,
        showOneQuestionAtATime: settings.showOneQuestionAtATime !== false,
        requireWebcam: !!settings.requireWebcam,
        passingScore: Number(settings.passingScore || 60)
    };
}

function parseGeneratedQuiz(text) {
    const questionBlocks = text
        .split(/\n(?=Q\d+\.|\d+\.|Question\s+\d+)/i)
        .map((block) => block.trim())
        .filter(Boolean);

    return questionBlocks.map((block, index) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const questionLine = lines.shift() || `Question ${index + 1}`;
        const options = [];
        let correctAnswer = '';

        for (const line of lines) {
            const answerMatch = line.match(/^Correct\s*Answer\s*:\s*(.+)$/i);
            if (answerMatch) {
                correctAnswer = answerMatch[1].trim();
                continue;
            }

            const optionMatch = line.match(/^([A-D])[).:-]?\s*(.+)$/i);
            if (optionMatch) {
                options.push({ label: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() });
            }
        }

        const matchedCorrect = options.find((option) =>
            option.label.toLowerCase() === correctAnswer.toLowerCase() ||
            option.text.toLowerCase() === correctAnswer.toLowerCase()
        );

        return {
            question: questionLine.replace(/^(Q\d+\.|\d+\.|Question\s+\d+[:.)-]?)\s*/i, '').trim(),
            options: options.map((option) => option.text),
            correctAnswer: matchedCorrect ? matchedCorrect.text : correctAnswer,
            explanation: ''
        };
    }).filter((question) => question.question && question.options.length >= 2 && question.correctAnswer);
}


async function isStudentEnrolled(studentId, courseId) {
    const [rows] = await db.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = \'active\'',
        [studentId, courseId]
    );
    return rows.length > 0;
}

function parseSettings(quiz) {
    return quiz.settings_json
        ? (typeof quiz.settings_json === 'string' ? JSON.parse(quiz.settings_json) : quiz.settings_json)
        : normalizeSettings({ timeLimit: quiz.duration_minutes, passingScore: quiz.passing_score });
}

async function saveQuiz({ title, description, course_id, assignment_id = null, teacher_id, questions, settings = {}, source = 'manual', quizText = null }) {
    const normalizedSettings = normalizeSettings(settings);
    const quizCode = generateQuizCode();
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [quizResult] = await connection.query(`
            INSERT INTO quizzes (
                course_id, assignment_id, teacher_id, quiz_text, title, description, quiz_code,
                status, duration_minutes, passing_score, settings_json, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
        `, [
            course_id,
            assignment_id || null,
            teacher_id,
            quizText || JSON.stringify(questions),
            title,
            description || '',
            quizCode,
            normalizedSettings.timeLimit,
            normalizedSettings.passingScore,
            JSON.stringify(normalizedSettings),
            source
        ]);

        const quizId = quizResult.insertId;

        for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
            const question = questions[questionIndex];
            const [questionResult] = await connection.query(`
                INSERT INTO quiz_questions (quiz_id, question_text, explanation, display_order)
                VALUES (?, ?, ?, ?)
            `, [quizId, question.question, question.explanation || '', questionIndex + 1]);

            for (let optionIndex = 0; optionIndex < question.options.length; optionIndex++) {
                const option = question.options[optionIndex];
                await connection.query(`
                    INSERT INTO quiz_options (question_id, option_text, is_correct, display_order)
                    VALUES (?, ?, ?, ?)
                `, [questionResult.insertId, option, option === question.correctAnswer, optionIndex + 1]);
            }
        }

        await connection.commit();
        return { quizId, quizCode };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getQuizWithQuestions(quizId) {
    const [quizzes] = await db.query(`
        SELECT q.*, c.title AS courseName
        FROM quizzes q
        JOIN courses c ON c.id = q.course_id
        WHERE q.id = ?
    `, [quizId]);

    if (quizzes.length === 0) {
        return null;
    }

    const quiz = quizzes[0];
    const [questions] = await db.query(`
        SELECT id, question_text AS question, explanation
        FROM quiz_questions
        WHERE quiz_id = ?
        ORDER BY display_order ASC, id ASC
    `, [quizId]);

    for (const question of questions) {
        const [options] = await db.query(`
            SELECT id, option_text AS text, is_correct AS isCorrect
            FROM quiz_options
            WHERE question_id = ?
            ORDER BY display_order ASC, id ASC
        `, [question.id]);

        question.options = options.map((option) => option.text);
        question.optionRecords = options;
        question.correctAnswer = options.find((option) => option.isCorrect)?.text || '';
    }

    return {
        id: String(quiz.id),
        title: quiz.title || `Quiz #${quiz.id}`,
        description: quiz.description || '',
        courseId: quiz.course_id,
        courseName: quiz.courseName,
        teacherId: quiz.teacher_id,
        code: quiz.quiz_code,
        status: quiz.status,
        scheduledDate: quiz.scheduled_date,
        duration: quiz.duration_minutes,
        passingScore: quiz.passing_score,
        settings: parseSettings(quiz),
        source: quiz.source,
        questions
    };
}

function serializeQuiz(quiz, { includeAnswers = false } = {}) {
    return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        courseId: quiz.courseId,
        courseName: quiz.courseName,
        code: quiz.code,
        status: quiz.status,
        scheduledDate: quiz.scheduledDate,
        duration: quiz.duration,
        passingScore: quiz.passingScore,
        settings: quiz.settings,
        source: quiz.source,
        questions: quiz.questions.map((question) => {
            const serialized = {
                id: question.id,
                question: question.question,
                options: question.options,
                explanation: question.explanation || ''
            };

            if (includeAnswers) {
                serialized.correctAnswer = question.correctAnswer;
            }

            return serialized;
        })
    };
}

async function authorizeQuizAccess(req, quiz, { requireActive = false } = {}) {
    if (!quiz) {
        return { allowed: false, status: 404, error: 'Quiz not found', includeAnswers: false };
    }

    if (req.user.role === 'teacher') {
        const ownsQuiz = quiz.teacherId === req.user.id;
        return {
            allowed: ownsQuiz,
            status: ownsQuiz ? 200 : 404,
            error: ownsQuiz ? null : 'Quiz not found',
            includeAnswers: ownsQuiz
        };
    }

    if (req.user.role !== 'student') {
        return { allowed: false, status: 403, error: 'Not authorized to access this quiz', includeAnswers: false };
    }

    if (requireActive && quiz.status !== 'active') {
        return { allowed: false, status: 404, error: 'Quiz not found', includeAnswers: false };
    }

    const enrolled = await isStudentEnrolled(req.user.id, quiz.courseId);
    return {
        allowed: enrolled && (!requireActive || quiz.status === 'active'),
        status: enrolled ? 403 : 404,
        error: enrolled ? 'Quiz is not available' : 'Quiz not found',
        includeAnswers: false
    };
}

router.get('/teacher', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [quizzes] = await db.query(`
            SELECT q.id, COALESCE(q.title, CONCAT('Quiz #', q.id)) AS title, q.description,
                   q.quiz_code AS code, q.status, q.scheduled_date AS scheduledDate,
                   q.duration_minutes AS duration, q.passing_score AS passingScore,
                   q.source, q.created_at AS createdAt, COUNT(qq.id) AS questionCount
            FROM quizzes q
            LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
            WHERE q.teacher_id = ?
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `, [req.user.id]);

        res.json(quizzes);
    } catch (error) {
        console.error('Teacher quiz list error:', error);
        res.status(500).json({ error: 'Failed to load quizzes' });
    }
});

router.get('/code/:code', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id FROM quizzes WHERE quiz_code = ? AND status = \'active\'', [req.params.code.toUpperCase()]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Quiz code not found' });
        }

        const quiz = await getQuizWithQuestions(rows[0].id);
        const access = await authorizeQuizAccess(req, quiz, { requireActive: req.user.role !== 'teacher' });
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        res.json(serializeQuiz(quiz, { includeAnswers: access.includeAnswers }));
    } catch (error) {
        console.error('Quiz code lookup error:', error);
        res.status(500).json({ error: 'Failed to look up quiz code' });
    }
});

router.get('/:id/results', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [attempts] = await db.query(`
            SELECT qa.*, u.username AS studentName, u.email AS studentEmail
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            JOIN users u ON u.id = qa.student_id
            WHERE qa.quiz_id = ? AND q.teacher_id = ? AND qa.status = 'submitted'
            ORDER BY qa.submitted_at DESC
        `, [req.params.id, req.user.id]);

        res.json(attempts);
    } catch (error) {
        console.error('Quiz results error:', error);
        res.status(500).json({ error: 'Failed to load quiz results' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const quiz = await getQuizWithQuestions(req.params.id);
        const access = await authorizeQuizAccess(req, quiz, { requireActive: req.user.role !== 'teacher' });
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        res.json(serializeQuiz(quiz, { includeAnswers: access.includeAnswers }));
    } catch (error) {
        console.error('Quiz detail error:', error);
        res.status(500).json({ error: 'Failed to load quiz' });
    }
});

router.post('/', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { title, description, course_id, assignment_id, questions, settings, source } = req.body;

        if (!title || !course_id || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Title, course_id, and questions are required' });
        }

        const [courses] = await db.query('SELECT id, title FROM courses WHERE id = ? AND teacher_id = ?', [course_id, req.user.id]);
        if (courses.length === 0) {
            return res.status(403).json({ error: 'Not authorized for this course' });
        }

        const saved = await saveQuiz({
            title,
            description,
            course_id,
            assignment_id,
            teacher_id: req.user.id,
            questions,
            settings,
            source: source || 'manual'
        });

        eventBus.emitDomain(EVENTS.QUIZ_CREATED, {
            actorId: req.user.id,
            courseId: Number(course_id),
            courseTitle: courses[0].title,
            quizId: saved.quizId,
            quizTitle: title,
            entityType: 'quiz',
            entityId: saved.quizId,
            referenceType: 'quiz',
            referenceId: saved.quizId,
            activityMetadata: { title },
            ...getClientInfo(req)
        });
        res.status(201).json({ message: 'Quiz created successfully', quiz_id: saved.quizId, quizCode: saved.quizCode });
    } catch (error) {
        console.error('Quiz create error:', error);
        res.status(500).json({ error: 'Failed to create quiz' });
    }
});

router.put('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { title, description, settings } = req.body;
        const normalizedSettings = normalizeSettings(settings || {});

        const [result] = await db.query(`
            UPDATE quizzes
            SET title = COALESCE(?, title), description = COALESCE(?, description),
                duration_minutes = ?, passing_score = ?, settings_json = ?
            WHERE id = ? AND teacher_id = ?
        `, [title || null, description || null, normalizedSettings.timeLimit, normalizedSettings.passingScore, JSON.stringify(normalizedSettings), req.params.id, req.user.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json({ message: 'Quiz updated successfully' });
    } catch (error) {
        console.error('Quiz update error:', error);
        res.status(500).json({ error: 'Failed to update quiz' });
    }
});

router.delete('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [result] = await db.query('UPDATE quizzes SET status = \'archived\' WHERE id = ? AND teacher_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json({ message: 'Quiz archived successfully' });
    } catch (error) {
        console.error('Quiz delete error:', error);
        res.status(500).json({ error: 'Failed to archive quiz' });
    }
});

router.post('/:id/activate', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const settings = normalizeSettings(req.body.settings || req.body);
        const quizCode = req.body.quizCode || generateQuizCode();
        const [result] = await db.query(`
            UPDATE quizzes
            SET status = 'active', quiz_code = ?, scheduled_date = ?, duration_minutes = ?, passing_score = ?, settings_json = ?
            WHERE id = ? AND teacher_id = ?
        `, [quizCode, req.body.scheduledDate || null, settings.timeLimit, settings.passingScore, JSON.stringify(settings), req.params.id, req.user.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const [quizzes] = await db.query(`
            SELECT q.id, q.title, q.course_id, c.title AS course_title
            FROM quizzes q
            JOIN courses c ON c.id = q.course_id
            WHERE q.id = ? AND q.teacher_id = ?
        `, [req.params.id, req.user.id]);

        if (quizzes.length > 0) {
            eventBus.emitDomain(EVENTS.QUIZ_ACTIVATED, {
                actorId: req.user.id,
                courseId: quizzes[0].course_id,
                courseTitle: quizzes[0].course_title,
                quizId: Number(req.params.id),
                quizTitle: quizzes[0].title,
                quizCode,
                entityType: 'quiz',
                entityId: Number(req.params.id),
                referenceType: 'quiz',
                referenceId: Number(req.params.id),
                activityMetadata: { quizCode },
                ...getClientInfo(req)
            });
        }

        res.json({ message: 'Quiz activated successfully', quizCode });
    } catch (error) {
        console.error('Quiz activate error:', error);
        res.status(500).json({ error: 'Failed to activate quiz' });
    }
});

router.post('/generate', authMiddleware, teacherMiddleware, async (req, res) => {
    const { context, course_id, assignment_id, title, description, settings } = req.body;

    try {
        if (!process.env.MISTRAL_API_KEY) {
            return res.status(500).json({ error: 'Mistral API key is not configured' });
        }

        if (!context || !course_id) {
            return res.status(400).json({ error: 'context and course_id are required' });
        }

        const [courses] = await db.query('SELECT id, title FROM courses WHERE id = ? AND teacher_id = ?', [course_id, req.user.id]);
        if (courses.length === 0) {
            return res.status(403).json({ error: 'Not authorized for this course' });
        }

        const response = await axios.post(
            'https://api.mistral.ai/v1/chat/completions',
            {
                model: 'mistral-medium',
                messages: [
                    { role: 'system', content: 'Create 5 MCQs from the provided context. Use this exact format: Q1. Question?\nA) Option\nB) Option\nC) Option\nD) Option\nCorrect Answer: A' },
                    { role: 'user', content: context }
                ]
            },
            { headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const quizText = response.data.choices[0].message.content;
        const questions = parseGeneratedQuiz(quizText);

        if (questions.length === 0) {
            return res.status(502).json({ error: 'AI response could not be parsed into quiz questions' });
        }

        const saved = await saveQuiz({
            title: title || 'Generated Quiz',
            description,
            course_id,
            assignment_id,
            teacher_id: req.user.id,
            questions,
            settings,
            source: 'ai-context',
            quizText
        });

        eventBus.emitDomain(EVENTS.QUIZ_CREATED, {
            actorId: req.user.id,
            courseId: Number(course_id),
            courseTitle: courses[0].title,
            quizId: saved.quizId,
            quizTitle: title || 'Generated Quiz',
            entityType: 'quiz',
            entityId: saved.quizId,
            referenceType: 'quiz',
            referenceId: saved.quizId,
            activityMetadata: { source: 'ai-context' },
            ...getClientInfo(req)
        });
        res.json({ message: 'Quiz generated and stored successfully', quiz_id: saved.quizId, quizCode: saved.quizCode, quiz: quizText, questions });
    } catch (err) {
        console.error('Quiz generation error:', err.response?.data || err);
        res.status(500).json({ error: 'Quiz generation or storage failed' });
    }
});

router.post('/generate-from-file', authMiddleware, teacherMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        if (!process.env.MISTRAL_API_KEY) {
            return res.status(500).json({ error: 'Mistral API key is not configured' });
        }

        const courseId = Number(req.body.course_id);
        const [courses] = await db.query('SELECT id, title FROM courses WHERE id = ? AND teacher_id = ?', [courseId, req.user.id]);
        if (courses.length === 0) {
            return res.status(403).json({ error: 'Not authorized for this course' });
        }

        const parsedPdf = await pdfParse(req.file.buffer);
        const context = parsedPdf.text?.trim();
        if (!context) {
            return res.status(400).json({ error: 'No readable text was found in the PDF' });
        }

        const [fileResult] = await db.query(`
            INSERT INTO uploaded_files (owner_id, course_id, original_name, mime_type, size_bytes)
            VALUES (?, ?, ?, ?, ?)
        `, [req.user.id, courseId, req.file.originalname, req.file.mimetype, req.file.size]);

        const response = await axios.post(
            'https://api.mistral.ai/v1/chat/completions',
            {
                model: 'mistral-medium',
                messages: [
                    { role: 'system', content: 'Create 5 MCQs from the provided PDF text. Use this exact format: Q1. Question?\nA) Option\nB) Option\nC) Option\nD) Option\nCorrect Answer: A' },
                    { role: 'user', content: context.slice(0, 12000) }
                ]
            },
            { headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const quizText = response.data.choices[0].message.content;
        const questions = parseGeneratedQuiz(quizText);
        if (questions.length === 0) {
            return res.status(502).json({ error: 'AI response could not be parsed into quiz questions' });
        }

        const saved = await saveQuiz({
            title: req.body.title || `Quiz on ${req.file.originalname}`,
            description: req.body.description || '',
            course_id: courseId,
            assignment_id: req.body.assignment_id || null,
            teacher_id: req.user.id,
            questions,
            settings: req.body.settings ? JSON.parse(req.body.settings) : {},
            source: 'pdf-content',
            quizText
        });

        eventBus.emitDomain(EVENTS.QUIZ_CREATED, {
            actorId: req.user.id,
            courseId,
            courseTitle: courses[0].title,
            quizId: saved.quizId,
            quizTitle: req.body.title || `Quiz on ${req.file.originalname}`,
            entityType: 'quiz',
            entityId: saved.quizId,
            referenceType: 'quiz',
            referenceId: saved.quizId,
            activityMetadata: { source: 'pdf-content', fileId: fileResult.insertId },
            ...getClientInfo(req)
        });
        res.status(201).json({ message: 'Quiz generated successfully', quiz_id: saved.quizId, quizCode: saved.quizCode, questions });
    } catch (error) {
        console.error('File quiz generation error:', error.response?.data || error);
        res.status(500).json({ error: 'Failed to generate quiz from file' });
    }
});

router.post('/:id/attempts', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: 'Only students can start quiz attempts' });
        }

        const quiz = await getQuizWithQuestions(req.params.id);
        const access = await authorizeQuizAccess(req, quiz, { requireActive: true });
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        const [result] = await db.query(`
            INSERT INTO quiz_attempts (quiz_id, student_id, total_questions)
            VALUES (?, ?, ?)
        `, [req.params.id, req.user.id, quiz.questions.length]);

        res.status(201).json({ attemptId: result.insertId });
    } catch (error) {
        console.error('Start attempt error:', error);
        res.status(500).json({ error: 'Failed to start quiz attempt' });
    }
});

router.post('/attempts/:attemptId/submit', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();

    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: 'Only students can submit quiz attempts' });
        }

        const { answers = {}, violations = [] } = req.body;
        const [attempts] = await connection.query('SELECT * FROM quiz_attempts WHERE id = ? AND student_id = ?', [req.params.attemptId, req.user.id]);
        if (attempts.length === 0) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        const attempt = attempts[0];
        if (attempt.status === 'submitted') {
            return res.status(409).json({ error: 'Attempt has already been submitted' });
        }

        const quiz = await getQuizWithQuestions(attempt.quiz_id);
        const access = await authorizeQuizAccess(req, quiz, { requireActive: true });
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        let score = 0;
        const answerSummary = [];

        await connection.beginTransaction();
        for (const question of quiz.questions) {
            const selectedAnswer = answers[question.id];
            const option = question.optionRecords.find((record) => record.text === selectedAnswer);
            const isCorrect = selectedAnswer === question.correctAnswer;
            if (isCorrect) score += 1;

            await connection.query(`
                INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option_id, selected_answer, is_correct)
                VALUES (?, ?, ?, ?, ?)
            `, [attempt.id, question.id, option?.id || null, selectedAnswer || null, isCorrect]);

            answerSummary.push({
                questionId: question.id,
                question: question.question,
                options: question.options,
                selectedAnswer: selectedAnswer || null,
                correctAnswer: question.correctAnswer,
                isCorrect,
                explanation: question.explanation || ''
            });
        }

        const percentage = quiz.questions.length ? Number(((score / quiz.questions.length) * 100).toFixed(2)) : 0;
        await connection.query(`
            UPDATE quiz_attempts
            SET score = ?, total_questions = ?, percentage = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP, violations = ?
            WHERE id = ?
        `, [score, quiz.questions.length, percentage, JSON.stringify(violations), attempt.id]);

        await connection.commit();
        eventBus.emitDomain(EVENTS.QUIZ_SUBMITTED, {
            actorId: req.user.id,
            studentId: req.user.id,
            teacherId: quiz.teacherId,
            courseId: quiz.courseId,
            quizId: quiz.id,
            attemptId: attempt.id,
            quizTitle: quiz.title,
            studentName: req.user.username,
            percentage,
            entityType: 'quiz_attempt',
            entityId: attempt.id,
            referenceType: 'quiz_attempt',
            referenceId: attempt.id,
            activityMetadata: { percentage },
            ...getClientInfo(req)
        });
        res.json({ score, totalQuestions: quiz.questions.length, percentage, answers: answerSummary });
    } catch (error) {
        await connection.rollback();
        console.error('Submit attempt error:', error);
        res.status(500).json({ error: 'Failed to submit quiz attempt' });
    } finally {
        connection.release();
    }
});

module.exports = router;