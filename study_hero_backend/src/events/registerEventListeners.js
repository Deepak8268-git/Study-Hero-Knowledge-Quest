const EVENTS = require('./eventNames');
const { auditLog } = require('../services/auditService');
const { logActivity } = require('../services/activityService');
const notificationService = require('../services/notificationService');
const { buildNotificationCopy, NOTIFICATION_TYPE } = require('../constants/notificationConstants');
const { emitToUser, emitToTeacher, emitToCourse } = require('../socket/socketEmitter');
const { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emailService');

function lightweightNotification(notification) {
    if (!notification) return null;
    return {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        referenceType: notification.referenceType,
        referenceId: notification.referenceId,
        courseId: notification.courseId,
        createdAt: notification.createdAt
    };
}

function onEvent(eventBus, eventName, handler) {
    eventBus.on(eventName, (event) => {
        const handlerInput = eventName === '*' ? event : event.payload;
        Promise.resolve(handler(handlerInput, event))
            .catch((error) => console.error(`Event listener error for ${eventName}:`, error.message));
    });
}

async function createAndDeliverNotification(notificationInput) {
    const notification = await notificationService.createNotification(notificationInput);
    if (!notification) return null;

    emitToUser(notification.recipientId, 'notification:new', lightweightNotification(notification));
    emitToUser(notification.recipientId, 'notification:unread_count:sync', {
        unreadCount: await notificationService.getUnreadCount(notification.recipientId)
    });

    return notification;
}

async function createAndDeliverCourseNotifications(courseId, notificationInput) {
    const notifications = await notificationService.createNotificationsForCourseStudents({
        ...notificationInput,
        courseId
    });

    for (const notification of notifications) {
        emitToUser(notification.recipientId, 'notification:new', lightweightNotification(notification));
        emitToUser(notification.recipientId, 'notification:unread_count:sync', {
            unreadCount: await notificationService.getUnreadCount(notification.recipientId)
        });
    }
    emitToCourse(courseId, 'dashboard:refresh', {
        reason: notificationInput.type,
        courseId,
        referenceType: notificationInput.referenceType,
        referenceId: notificationInput.referenceId
    });

    return notifications;
}

function registerNotificationListeners(eventBus) {
    onEvent(eventBus, EVENTS.QUIZ_CREATED, async ({ actorId, courseId, quizId, quizTitle, courseTitle }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.QUIZ_CREATED, { quizTitle, courseTitle });
        await createAndDeliverCourseNotifications(courseId, {
            actorId,
            type: NOTIFICATION_TYPE.QUIZ_CREATED,
            ...copy,
            referenceType: 'quiz',
            referenceId: quizId,
            metadata: { quizTitle, courseTitle }
        });
    });

    onEvent(eventBus, EVENTS.QUIZ_ACTIVATED, async ({ actorId, courseId, quizId, quizTitle, courseTitle, quizCode }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.QUIZ_ACTIVATED, { quizTitle, courseTitle });
        await createAndDeliverCourseNotifications(courseId, {
            actorId,
            type: NOTIFICATION_TYPE.QUIZ_ACTIVATED,
            ...copy,
            referenceType: 'quiz',
            referenceId: quizId,
            metadata: { quizTitle, courseTitle, quizCode }
        });
    });

    onEvent(eventBus, EVENTS.QUIZ_SUBMITTED, async ({ actorId, teacherId, courseId, quizId, attemptId, quizTitle, studentName, percentage }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.QUIZ_SUBMITTED, { studentName, quizTitle });
        await createAndDeliverNotification({
            recipientId: teacherId,
            actorId,
            courseId,
            type: NOTIFICATION_TYPE.QUIZ_SUBMITTED,
            ...copy,
            referenceType: 'quiz_attempt',
            referenceId: attemptId,
            metadata: { quizId, quizTitle, studentName, percentage }
        });
        emitToTeacher(teacherId, 'dashboard:refresh', { reason: EVENTS.QUIZ_SUBMITTED, quizId, attemptId, courseId });
    });

    onEvent(eventBus, EVENTS.ASSIGNMENT_CREATED, async ({ actorId, courseId, assignmentId, assignmentTitle, courseTitle }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.ASSIGNMENT_CREATED, { assignmentTitle, courseTitle });
        await createAndDeliverCourseNotifications(courseId, {
            actorId,
            type: NOTIFICATION_TYPE.ASSIGNMENT_CREATED,
            ...copy,
            referenceType: 'assignment',
            referenceId: assignmentId,
            metadata: { assignmentTitle, courseTitle }
        });
    });

    onEvent(eventBus, EVENTS.ASSIGNMENT_SUBMITTED, async ({ actorId, teacherId, courseId, assignmentId, submissionId, assignmentTitle, studentName }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.ASSIGNMENT_SUBMITTED, { assignmentTitle, studentName });
        await createAndDeliverNotification({
            recipientId: teacherId,
            actorId,
            courseId,
            type: NOTIFICATION_TYPE.ASSIGNMENT_SUBMITTED,
            ...copy,
            referenceType: 'submission',
            referenceId: submissionId,
            metadata: { assignmentId, assignmentTitle, studentName }
        });
        emitToTeacher(teacherId, 'dashboard:refresh', { reason: EVENTS.ASSIGNMENT_SUBMITTED, assignmentId, submissionId, courseId });
    });

    onEvent(eventBus, EVENTS.ASSIGNMENT_GRADED, async ({ actorId, studentId, courseId, assignmentId, submissionId, assignmentTitle, grade }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.ASSIGNMENT_GRADED, { assignmentTitle, grade });
        await createAndDeliverNotification({
            recipientId: studentId,
            actorId,
            courseId,
            type: NOTIFICATION_TYPE.ASSIGNMENT_GRADED,
            ...copy,
            referenceType: 'submission',
            referenceId: submissionId,
            metadata: { assignmentId, assignmentTitle, grade }
        });
    });

    onEvent(eventBus, EVENTS.COURSE_UPDATED, async ({ actorId, courseId, courseTitle }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.COURSE_UPDATED, { courseTitle });
        await createAndDeliverCourseNotifications(courseId, {
            actorId,
            type: NOTIFICATION_TYPE.COURSE_UPDATED,
            ...copy,
            referenceType: 'course',
            referenceId: courseId,
            metadata: { courseTitle }
        });
    });

    onEvent(eventBus, EVENTS.ANNOUNCEMENT_CREATED, async ({ actorId, courseId, announcementId, announcementTitle, courseTitle }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.ANNOUNCEMENT_CREATED, { announcementTitle, courseTitle });
        await createAndDeliverCourseNotifications(courseId, {
            actorId,
            type: NOTIFICATION_TYPE.ANNOUNCEMENT_CREATED,
            ...copy,
            referenceType: 'announcement',
            referenceId: announcementId,
            metadata: { announcementTitle, courseTitle }
        });
    });

    onEvent(eventBus, EVENTS.USER_PASSWORD_CHANGED, async ({ userId }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.USER_PASSWORD_CHANGED);
        await createAndDeliverNotification({
            recipientId: userId,
            actorId: userId,
            type: NOTIFICATION_TYPE.USER_PASSWORD_CHANGED,
            ...copy,
            referenceType: 'user',
            referenceId: userId
        });
    });

    onEvent(eventBus, EVENTS.SECURITY_LOGIN, async ({ userId }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.SECURITY_LOGIN);
        await createAndDeliverNotification({
            recipientId: userId,
            actorId: userId,
            type: NOTIFICATION_TYPE.SECURITY_LOGIN,
            ...copy,
            referenceType: 'user',
            referenceId: userId
        });
    });

    onEvent(eventBus, EVENTS.SECURITY_LOGOUT, async ({ userId }) => {
        const copy = buildNotificationCopy(NOTIFICATION_TYPE.SECURITY_LOGOUT);
        await createAndDeliverNotification({
            recipientId: userId,
            actorId: userId,
            type: NOTIFICATION_TYPE.SECURITY_LOGOUT,
            ...copy,
            referenceType: 'user',
            referenceId: userId
        });
    });
}

function registerSocketOnlyListeners(eventBus) {
    onEvent(eventBus, EVENTS.COURSE_CREATED, async ({ actorId, courseId }) => {
        emitToTeacher(actorId, 'dashboard:refresh', { reason: EVENTS.COURSE_CREATED, courseId });
    });

    onEvent(eventBus, EVENTS.AI_OPERATION_COMPLETED, async ({ userId, actorId, courseId, entityId }) => {
        emitToUser(userId || actorId, 'dashboard:refresh', { reason: EVENTS.AI_OPERATION_COMPLETED, courseId, entityId });
    });
}

function registerEmailListeners(eventBus) {
    onEvent(eventBus, EVENTS.USER_REGISTERED, async ({ user, verificationToken }) => {
        if (verificationToken) {
            await sendVerificationEmail({ to: user.email, username: user.username, token: verificationToken });
        }
    });

    onEvent(eventBus, EVENTS.USER_VERIFICATION_REQUESTED, async ({ user, verificationToken }) => {
        if (verificationToken) {
            await sendVerificationEmail({ to: user.email, username: user.username, token: verificationToken });
        }
    });

    onEvent(eventBus, EVENTS.USER_PASSWORD_RESET_REQUESTED, async ({ user, resetToken }) => {
        if (resetToken) {
            await sendPasswordResetEmail({ to: user.email, username: user.username, token: resetToken });
        }
    });

    onEvent(eventBus, EVENTS.USER_PASSWORD_CHANGED, async ({ user }) => {
        if (user?.email) {
            await sendPasswordChangedEmail({ to: user.email, username: user.username });
        }
    });
}

function registerAuditListeners(eventBus) {
    onEvent(eventBus, '*', async ({ payload, name }) => {
        const userId = payload.userId || payload.actorId || payload.teacherId || payload.studentId || null;
        await auditLog({
            userId,
            action: name,
            entityType: payload.referenceType || payload.entityType || 'event',
            entityId: payload.referenceId || payload.entityId || payload.quizId || payload.assignmentId || payload.courseId || null,
            ipAddress: payload.ipAddress || null,
            userAgent: payload.userAgent || null,
            metadata: payload.auditMetadata || {}
        });
    });
}

function registerActivityListeners(eventBus) {
    const activityEvents = new Set([
        EVENTS.QUIZ_CREATED,
        EVENTS.QUIZ_ACTIVATED,
        EVENTS.QUIZ_SUBMITTED,
        EVENTS.ASSIGNMENT_CREATED,
        EVENTS.ASSIGNMENT_SUBMITTED,
        EVENTS.ASSIGNMENT_GRADED,
        EVENTS.COURSE_CREATED,
        EVENTS.COURSE_UPDATED,
        EVENTS.ANNOUNCEMENT_CREATED,
        EVENTS.AI_OPERATION_COMPLETED,
        EVENTS.LMS_OPERATION_COMPLETED
    ]);

    onEvent(eventBus, '*', async ({ payload, name }) => {
        if (!activityEvents.has(name)) return;
        await logActivity({
            actorId: payload.actorId || payload.userId || null,
            targetUserId: payload.studentId || null,
            courseId: payload.courseId || null,
            entityType: payload.entityType || name.split('.')[0],
            entityId: payload.entityId || payload.quizId || payload.assignmentId || payload.courseId || payload.announcementId || payload.submissionId || null,
            action: name,
            metadata: payload.activityMetadata || {}
        });
    });
}

function registerEventListeners(eventBus) {
    registerNotificationListeners(eventBus);
    registerSocketOnlyListeners(eventBus);
    registerEmailListeners(eventBus);
    registerAuditListeners(eventBus);
    registerActivityListeners(eventBus);
}

module.exports = registerEventListeners;

