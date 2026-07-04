const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');

const router = express.Router();

function getClientInfo(req) {
    return { ipAddress: req.ip || req.connection?.remoteAddress || null, userAgent: req.get('user-agent') || null };
}

async function canAccessCourse(user, courseId) {
    if (!courseId) return false;
    if (user.role === 'teacher') {
        const [rows] = await db.query('SELECT id FROM courses WHERE id = ? AND teacher_id = ?', [courseId, user.id]);
        return rows.length > 0;
    }
    const [rows] = await db.query('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = \'active\'', [courseId, user.id]);
    return rows.length > 0;
}

async function requireCourseAccess(req, res, courseId) {
    const allowed = await canAccessCourse(req.user, Number(courseId));
    if (!allowed) {
        res.status(403).json({ error: 'Not authorized for this course' });
        return false;
    }
    return true;
}

async function isStudentEnrolled(courseId, studentId) {
    const [rows] = await db.query('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = \'active\'', [courseId, studentId]);
    return rows.length > 0;
}

function emitLms(req, { feature, entityId = null, courseId = null, userId = null, title = null, metadata = {} }) {
    eventBus.emitDomain(EVENTS.LMS_OPERATION_COMPLETED, {
        actorId: req.user.id,
        userId,
        courseId,
        entityType: 'lms',
        entityId,
        referenceType: 'lms',
        referenceId: entityId,
        activityMetadata: { feature, title, ...metadata },
        auditMetadata: { feature, title, ...metadata },
        ...getClientInfo(req)
    });
}

function parseJson(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.stringify(value);
}

router.post('/attendance/sessions', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { courseId, title, sessionDate, startTime, endTime, status = 'open', metadata } = req.body;
        if (!courseId || !title || !sessionDate) return res.status(400).json({ error: 'courseId, title, and sessionDate are required' });
        if (!await requireCourseAccess(req, res, courseId)) return;
        const [result] = await db.query(`
            INSERT INTO attendance_sessions (course_id, teacher_id, title, session_date, start_time, end_time, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [courseId, req.user.id, title, sessionDate, startTime || null, endTime || null, status, parseJson(metadata)]);
        emitLms(req, { feature: 'attendance_session_created', entityId: result.insertId, courseId, title });
        res.status(201).json({ sessionId: result.insertId, message: 'Attendance session created' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create attendance session' });
    }
});

router.get('/attendance/sessions', authMiddleware, async (req, res) => {
    const { courseId } = req.query;
    if (courseId && !await requireCourseAccess(req, res, courseId)) return;
    const params = [];
    let where = '1=1';
    if (courseId) { where += ' AND s.course_id = ?'; params.push(courseId); }
    if (req.user.role === 'teacher') { where += ' AND s.teacher_id = ?'; params.push(req.user.id); }
    if (req.user.role === 'student') { where += ' AND EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = s.course_id AND e.student_id = ? AND e.status = \'active\')'; params.push(req.user.id); }
    const [rows] = await db.query(`SELECT s.*, c.title AS course_title FROM attendance_sessions s JOIN courses c ON c.id = s.course_id WHERE ${where} ORDER BY s.session_date DESC, s.start_time DESC`, params);
    res.json(rows);
});

router.post('/attendance/sessions/:sessionId/records', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { records = [] } = req.body;
        const [sessions] = await db.query('SELECT * FROM attendance_sessions WHERE id = ? AND teacher_id = ?', [req.params.sessionId, req.user.id]);
        if (sessions.length === 0) return res.status(404).json({ error: 'Attendance session not found' });
        for (const record of records) {
            await db.query(`
                INSERT INTO attendance_records (session_id, student_id, status, remarks, marked_by)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), marked_by = VALUES(marked_by), marked_at = CURRENT_TIMESTAMP
            `, [req.params.sessionId, record.studentId, record.status || 'absent', record.remarks || null, req.user.id]);
            emitLms(req, { feature: 'attendance_marked', entityId: Number(req.params.sessionId), courseId: sessions[0].course_id, userId: record.studentId, title: 'Attendance updated' });
        }
        res.json({ message: 'Attendance records saved', count: records.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save attendance records' });
    }
});

const getStudentAttendance = async (req, res) => {
    if (req.user.role === 'teacher' && !req.params.studentId) {
        return res.status(400).json({ error: 'studentId is required for teacher attendance lookup' });
    }
    const studentId = req.user.role === 'student' ? req.user.id : Number(req.params.studentId);
    const [rows] = await db.query(`
        SELECT ar.*, s.session_date, s.title, c.title AS course_title, c.id AS course_id
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        JOIN courses c ON c.id = s.course_id
        WHERE ar.student_id = ? AND (? = 'student' OR c.teacher_id = ?)
        ORDER BY s.session_date DESC
    `, [studentId, req.user.role, req.user.id]);
    const total = rows.length;
    const attended = rows.filter((row) => ['present', 'late', 'excused'].includes(row.status)).length;
    res.json({ records: rows, percentage: total ? Math.round((attended / total) * 100) : 0 });
};

router.get('/attendance/student', authMiddleware, getStudentAttendance);
router.get('/attendance/student/:studentId', authMiddleware, getStudentAttendance);

router.post('/timetable', authMiddleware, teacherMiddleware, async (req, res) => {
    const { courseId, subject, classroom, dayOfWeek, startTime, endTime, effectiveFrom, effectiveTo } = req.body;
    if (!courseId || !subject || dayOfWeek === undefined || !startTime || !endTime) return res.status(400).json({ error: 'courseId, subject, dayOfWeek, startTime, and endTime are required' });
    if (!await requireCourseAccess(req, res, courseId)) return;
    const [result] = await db.query(`
        INSERT INTO timetable_entries (course_id, teacher_id, subject, classroom, day_of_week, start_time, end_time, effective_from, effective_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [courseId, req.user.id, subject, classroom || null, dayOfWeek, startTime, endTime, effectiveFrom || null, effectiveTo || null]);
    emitLms(req, { feature: 'timetable_updated', entityId: result.insertId, courseId, title: subject });
    res.status(201).json({ timetableId: result.insertId });
});

router.get('/timetable', authMiddleware, async (req, res) => {
    const { courseId } = req.query;
    const params = [];
    let where = '1=1';
    if (courseId) { if (!await requireCourseAccess(req, res, courseId)) return; where += ' AND t.course_id = ?'; params.push(courseId); }
    if (req.user.role === 'teacher') { where += ' AND t.teacher_id = ?'; params.push(req.user.id); }
    if (req.user.role === 'student') { where += ' AND EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = t.course_id AND e.student_id = ? AND e.status = \'active\')'; params.push(req.user.id); }
    const [rows] = await db.query(`SELECT t.*, c.title AS course_title FROM timetable_entries t JOIN courses c ON c.id = t.course_id WHERE ${where} ORDER BY t.day_of_week, t.start_time`, params);
    res.json(rows);
});

router.post('/calendar/events', authMiddleware, async (req, res) => {
    const { courseId, type, title, description, startAt, endAt, visibility = 'course', referenceType, referenceId, metadata } = req.body;
    if (!type || !title || !startAt) return res.status(400).json({ error: 'type, title, and startAt are required' });
    if (courseId && !await requireCourseAccess(req, res, courseId)) return;
    const [result] = await db.query(`
        INSERT INTO calendar_events (course_id, created_by, type, title, description, start_at, end_at, visibility, reference_type, reference_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [courseId || null, req.user.id, type, title, description || null, startAt, endAt || null, visibility, referenceType || null, referenceId || null, parseJson(metadata)]);
    emitLms(req, { feature: 'calendar_event_created', entityId: result.insertId, courseId, title });
    res.status(201).json({ eventId: result.insertId });
});

router.get('/calendar/events', authMiddleware, async (req, res) => {
    const { from, to } = req.query;
    const params = [from || '1970-01-01', to || '2999-12-31'];
    let access = '(visibility = \'global\' OR created_by = ?';
    params.push(req.user.id);
    if (req.user.role === 'student') { access += ' OR course_id IN (SELECT course_id FROM enrollments WHERE student_id = ? AND status = \'active\')'; params.push(req.user.id); }
    if (req.user.role === 'teacher') { access += ' OR course_id IN (SELECT id FROM courses WHERE teacher_id = ?)'; params.push(req.user.id); }
    access += ')';
    const [rows] = await db.query(`SELECT * FROM calendar_events WHERE start_at BETWEEN ? AND ? AND ${access} ORDER BY start_at ASC`, params);
    res.json(rows);
});

router.patch('/assignments/:id/publish', authMiddleware, teacherMiddleware, async (req, res) => {
    const [result] = await db.query(`
        UPDATE assignments a JOIN courses c ON c.id = a.course_id
        SET a.status = 'published', a.published_at = CURRENT_TIMESTAMP
        WHERE a.id = ? AND c.teacher_id = ?
    `, [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Assignment not found' });

    const [assignments] = await db.query(`
        SELECT a.id, a.title, a.course_id, c.title AS course_title
        FROM assignments a
        JOIN courses c ON c.id = a.course_id
        WHERE a.id = ? AND c.teacher_id = ?
    `, [req.params.id, req.user.id]);

    if (assignments.length > 0) {
        eventBus.emitDomain(EVENTS.ASSIGNMENT_CREATED, {
            actorId: req.user.id,
            courseId: assignments[0].course_id,
            courseTitle: assignments[0].course_title,
            assignmentId: Number(req.params.id),
            assignmentTitle: assignments[0].title,
            entityType: 'assignment',
            entityId: Number(req.params.id),
            referenceType: 'assignment',
            referenceId: Number(req.params.id),
            activityMetadata: { published: true },
            ...getClientInfo(req)
        });
    }

    emitLms(req, { feature: 'assignment_published', entityId: Number(req.params.id), courseId: assignments[0]?.course_id || null, title: 'Assignment published' });
    res.json({ message: 'Assignment published' });
});

router.patch('/submissions/:submissionId/feedback', authMiddleware, teacherMiddleware, async (req, res) => {
    const { feedback, grade } = req.body;
    const [submissions] = await db.query(`SELECT s.*, a.course_id, c.teacher_id FROM submissions s JOIN assignments a ON a.id = s.assignment_no JOIN courses c ON c.id = a.course_id WHERE s.id = ?`, [req.params.submissionId]);
    if (submissions.length === 0 || submissions[0].teacher_id !== req.user.id) return res.status(404).json({ error: 'Submission not found' });
    await db.query('UPDATE submissions SET feedback = ?, grade = COALESCE(?, grade), status = \'graded\' WHERE id = ?', [feedback || null, grade ?? null, req.params.submissionId]);
    emitLms(req, { feature: 'assignment_feedback_added', entityId: Number(req.params.submissionId), courseId: submissions[0].course_id, userId: submissions[0].student_id, title: 'Assignment feedback ready' });
    res.json({ message: 'Feedback saved' });
});

router.post('/rubrics', authMiddleware, teacherMiddleware, async (req, res) => {
    const { courseId, assignmentId, title, description, criteria = [] } = req.body;
    if (!courseId || !title) return res.status(400).json({ error: 'courseId and title are required' });
    if (!await requireCourseAccess(req, res, courseId)) return;
    const [result] = await db.query('INSERT INTO rubrics (course_id, assignment_id, teacher_id, title, description) VALUES (?, ?, ?, ?, ?)', [courseId, assignmentId || null, req.user.id, title, description || null]);
    for (let index = 0; index < criteria.length; index++) {
        const item = criteria[index];
        await db.query('INSERT INTO rubric_criteria (rubric_id, name, description, max_score, display_order) VALUES (?, ?, ?, ?, ?)', [result.insertId, item.name, item.description || null, item.maxScore || 10, index + 1]);
    }
    emitLms(req, { feature: 'rubric_created', entityId: result.insertId, courseId, title });
    res.status(201).json({ rubricId: result.insertId });
});

router.get('/rubrics', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM rubrics WHERE teacher_id = ? OR course_id IN (SELECT course_id FROM enrollments WHERE student_id = ? AND status = \'active\') ORDER BY created_at DESC', [req.user.id, req.user.id]);
    res.json(rows);
});

router.post('/gradebook', authMiddleware, teacherMiddleware, async (req, res) => {
    const { courseId, studentId, sourceType, sourceId, title, score, maxScore = 100, weight = 1, feedback } = req.body;
    if (!courseId || !studentId || !sourceType || !title) return res.status(400).json({ error: 'courseId, studentId, sourceType, and title are required' });
    if (!await requireCourseAccess(req, res, courseId)) return;
    if (!await isStudentEnrolled(courseId, studentId)) return res.status(400).json({ error: 'Student is not enrolled in this course' });
    const [result] = await db.query('INSERT INTO gradebook_entries (course_id, student_id, source_type, source_id, title, score, max_score, weight, feedback, graded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [courseId, studentId, sourceType, sourceId || null, title, score || 0, maxScore, weight, feedback || null, req.user.id]);
    emitLms(req, { feature: 'gradebook_updated', entityId: result.insertId, courseId, userId: studentId, title: 'Gradebook updated' });
    res.status(201).json({ gradeId: result.insertId });
});

router.get('/gradebook', authMiddleware, async (req, res) => {
    const studentId = req.user.role === 'student' ? req.user.id : req.query.studentId;
    const params = [];
    let where = '1=1';
    if (studentId) { where += ' AND g.student_id = ?'; params.push(studentId); }
    if (req.query.courseId) { where += ' AND g.course_id = ?'; params.push(req.query.courseId); }
    if (req.user.role === 'teacher') { where += ' AND g.course_id IN (SELECT id FROM courses WHERE teacher_id = ?)'; params.push(req.user.id); }
    const [rows] = await db.query(`SELECT g.*, c.title AS course_title FROM gradebook_entries g JOIN courses c ON c.id = g.course_id WHERE ${where} ORDER BY g.graded_at DESC`, params);
    res.json(rows);
});

router.post('/certificates', authMiddleware, teacherMiddleware, async (req, res) => {
    const { userId, courseId, type, title, description, metadata } = req.body;
    if (!userId || !type || !title) return res.status(400).json({ error: 'userId, type, and title are required' });
    if (courseId && !await requireCourseAccess(req, res, courseId)) return;
    if (courseId && !await isStudentEnrolled(courseId, userId)) return res.status(400).json({ error: 'Student is not enrolled in this course' });
    const certificateUid = `SH-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const qrUrl = `${process.env.FRONTEND_URL || ''}/certificate/${certificateUid}`;
    const [result] = await db.query('INSERT INTO certificates (certificate_uid, user_id, course_id, issued_by, type, title, description, qr_verification_url, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [certificateUid, userId, courseId || null, req.user.id, type, title, description || null, qrUrl, parseJson(metadata)]);
    emitLms(req, { feature: 'certificate_issued', entityId: result.insertId, courseId, userId, title: 'Certificate issued' });
    res.status(201).json({ certificateId: result.insertId, certificateUid, qrVerificationUrl: qrUrl });
});

router.get('/certificates', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM certificates WHERE user_id = ? OR issued_by = ? ORDER BY issued_at DESC', [req.user.id, req.user.id]);
    res.json(rows);
});

router.get('/certificates/verify/:uid', async (req, res) => {
    const [rows] = await db.query('SELECT certificate_uid, title, type, issued_at FROM certificates WHERE certificate_uid = ?', [req.params.uid]);
    if (rows.length === 0) return res.status(404).json({ error: 'Certificate not found' });
    res.json({ valid: true, certificate: rows[0] });
});

router.post('/forum/posts', authMiddleware, async (req, res) => {
    const { courseId, type = 'question', title, content, isPinned = false } = req.body;
    if (!courseId || !title || !content) return res.status(400).json({ error: 'courseId, title, and content are required' });
    if (!await requireCourseAccess(req, res, courseId)) return;
    const pinned = req.user.role === 'teacher' && isPinned;
    const [result] = await db.query('INSERT INTO discussion_posts (course_id, author_id, type, title, content, is_pinned) VALUES (?, ?, ?, ?, ?, ?)', [courseId, req.user.id, type, title, content, pinned]);
    emitLms(req, { feature: 'forum_post_created', entityId: result.insertId, courseId, title });
    res.status(201).json({ postId: result.insertId });
});

router.get('/forum/course/:courseId', authMiddleware, async (req, res) => {
    if (!await requireCourseAccess(req, res, req.params.courseId)) return;
    const [posts] = await db.query('SELECT p.*, u.username AS author_name FROM discussion_posts p JOIN users u ON u.id = p.author_id WHERE p.course_id = ? ORDER BY p.is_pinned DESC, p.created_at DESC', [req.params.courseId]);
    res.json(posts);
});

router.post('/forum/posts/:postId/replies', authMiddleware, async (req, res) => {
    const { content } = req.body;
    const [posts] = await db.query('SELECT * FROM discussion_posts WHERE id = ?', [req.params.postId]);
    if (posts.length === 0 || !await requireCourseAccess(req, res, posts[0].course_id)) return;
    const [result] = await db.query('INSERT INTO discussion_replies (post_id, author_id, content) VALUES (?, ?, ?)', [req.params.postId, req.user.id, content]);
    emitLms(req, { feature: 'forum_reply_created', entityId: result.insertId, courseId: posts[0].course_id, title: 'New forum reply' });
    res.status(201).json({ replyId: result.insertId });
});

router.post('/progress', authMiddleware, async (req, res) => {
    const { courseId, moduleKey, lessonKey, status = 'in_progress', progressPercent = 0 } = req.body;
    if (!courseId || !moduleKey) return res.status(400).json({ error: 'courseId and moduleKey are required' });
    if (!await requireCourseAccess(req, res, courseId)) return;
    await db.query(`INSERT INTO course_progress (course_id, student_id, module_key, lesson_key, status, progress_percent, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), progress_percent = VALUES(progress_percent), completed_at = VALUES(completed_at)`, [courseId, req.user.id, moduleKey, lessonKey || '', status, progressPercent, status === 'completed' ? new Date() : null]);
    emitLms(req, { feature: 'course_progress_updated', courseId, userId: req.user.id, title: 'Course progress updated' });
    res.json({ message: 'Progress saved' });
});

router.get('/progress', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM course_progress WHERE student_id = ? ORDER BY updated_at DESC', [req.user.id]);
    res.json(rows);
});

router.post('/achievements', authMiddleware, teacherMiddleware, async (req, res) => {
    const { userId, courseId, type, title, description, xp = 0, metadata } = req.body;
    if (courseId && !await requireCourseAccess(req, res, courseId)) return;
    if (courseId && !await isStudentEnrolled(courseId, userId)) return res.status(400).json({ error: 'Student is not enrolled in this course' });
    const [result] = await db.query('INSERT INTO achievements (user_id, course_id, type, title, description, xp, awarded_by, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userId, courseId || null, type, title, description || null, xp, req.user.id, parseJson(metadata)]);
    await db.query('INSERT INTO user_gamification (user_id, xp, last_activity_date) VALUES (?, ?, CURRENT_DATE()) ON DUPLICATE KEY UPDATE xp = xp + VALUES(xp), last_activity_date = CURRENT_DATE()', [userId, xp]);
    emitLms(req, { feature: 'achievement_awarded', entityId: result.insertId, courseId, userId, title: 'Achievement awarded' });
    res.status(201).json({ achievementId: result.insertId });
});

router.get('/gamification/leaderboard', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT g.*, u.username FROM user_gamification g JOIN users u ON u.id = g.user_id ORDER BY g.xp DESC LIMIT 50');
    res.json(rows);
});

router.post('/notes', authMiddleware, async (req, res) => {
    const { courseId, title, content, category, tags = [], attachments = [] } = req.body;
    const [result] = await db.query('INSERT INTO personal_notes (user_id, course_id, title, content, category, tags, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.user.id, courseId || null, title, content, category || null, JSON.stringify(tags), JSON.stringify(attachments)]);
    res.status(201).json({ noteId: result.insertId });
});

router.get('/notes', authMiddleware, async (req, res) => {
    const search = `%${req.query.search || ''}%`;
    const [rows] = await db.query('SELECT * FROM personal_notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ? OR category LIKE ?) ORDER BY updated_at DESC', [req.user.id, search, search, search]);
    res.json(rows);
});

router.post('/bookmarks', authMiddleware, async (req, res) => {
    const { targetType, targetId, title, metadata } = req.body;
    await db.query('INSERT INTO bookmarks (user_id, target_type, target_id, title, metadata) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), metadata = VALUES(metadata)', [req.user.id, targetType, targetId, title || null, parseJson(metadata)]);
    res.status(201).json({ message: 'Bookmark saved' });
});

router.get('/bookmarks', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
});

router.post('/reports', authMiddleware, async (req, res) => {
    const { courseId, type, title, format = 'json' } = req.body;
    if (courseId && !await requireCourseAccess(req, res, courseId)) return;
    const payload = { generatedFor: req.user.id, courseId: courseId || null, type, generatedAt: new Date().toISOString() };
    const [result] = await db.query('INSERT INTO reports (user_id, course_id, type, title, format, payload) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, courseId || null, type, title || `${type} report`, format, JSON.stringify(payload)]);
    res.status(201).json({ reportId: result.insertId, payload });
});

router.get('/reports', authMiddleware, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM reports WHERE user_id = ? ORDER BY generated_at DESC', [req.user.id]);
    res.json(rows);
});

router.post('/downloads', authMiddleware, async (req, res) => {
    const { targetType, targetId, action, metadata } = req.body;
    await db.query('INSERT INTO download_events (user_id, target_type, target_id, action, metadata) VALUES (?, ?, ?, ?, ?)', [req.user.id, targetType, targetId, action, parseJson(metadata)]);
    res.status(201).json({ message: 'Download event tracked' });
});

module.exports = router;


