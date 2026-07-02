const NOTIFICATION_PRIORITY = {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

const NOTIFICATION_TYPE = {
    QUIZ_CREATED: 'quiz.created',
    QUIZ_ACTIVATED: 'quiz.activated',
    QUIZ_SUBMITTED: 'quiz.submitted',
    ASSIGNMENT_CREATED: 'assignment.created',
    ASSIGNMENT_SUBMITTED: 'assignment.submitted',
    ASSIGNMENT_GRADED: 'assignment.graded',
    COURSE_CREATED: 'course.created',
    COURSE_UPDATED: 'course.updated',
    ANNOUNCEMENT_CREATED: 'announcement.created',
    USER_REGISTERED: 'user.registered',
    USER_EMAIL_VERIFIED: 'user.email_verified',
    USER_PASSWORD_CHANGED: 'user.password_changed',
    SECURITY_LOGIN: 'security.login',
    SECURITY_LOGOUT: 'security.logout'
};

const NOTIFICATION_COPY = {
    [NOTIFICATION_TYPE.QUIZ_CREATED]: {
        title: 'New quiz created',
        message: ({ quizTitle, courseTitle }) => `${quizTitle || 'A quiz'} was created${courseTitle ? ` for ${courseTitle}` : ''}.`,
        priority: NOTIFICATION_PRIORITY.NORMAL
    },
    [NOTIFICATION_TYPE.QUIZ_ACTIVATED]: {
        title: 'Quiz is now active',
        message: ({ quizTitle, courseTitle }) => `${quizTitle || 'A quiz'} is now available${courseTitle ? ` in ${courseTitle}` : ''}.`,
        priority: NOTIFICATION_PRIORITY.HIGH
    },
    [NOTIFICATION_TYPE.QUIZ_SUBMITTED]: {
        title: 'Quiz submitted',
        message: ({ studentName, quizTitle }) => `${studentName || 'A student'} submitted ${quizTitle || 'a quiz'}.`,
        priority: NOTIFICATION_PRIORITY.NORMAL
    },
    [NOTIFICATION_TYPE.ASSIGNMENT_CREATED]: {
        title: 'New assignment',
        message: ({ assignmentTitle, courseTitle }) => `${assignmentTitle || 'An assignment'} was posted${courseTitle ? ` in ${courseTitle}` : ''}.`,
        priority: NOTIFICATION_PRIORITY.NORMAL
    },
    [NOTIFICATION_TYPE.ASSIGNMENT_SUBMITTED]: {
        title: 'Assignment submitted',
        message: ({ studentName, assignmentTitle }) => `${studentName || 'A student'} submitted ${assignmentTitle || 'an assignment'}.`,
        priority: NOTIFICATION_PRIORITY.NORMAL
    },
    [NOTIFICATION_TYPE.ASSIGNMENT_GRADED]: {
        title: 'Assignment graded',
        message: ({ assignmentTitle, grade }) => `${assignmentTitle || 'Your assignment'} was graded${grade !== undefined && grade !== null ? `: ${grade}` : ''}.`,
        priority: NOTIFICATION_PRIORITY.HIGH
    },
    [NOTIFICATION_TYPE.COURSE_CREATED]: {
        title: 'Course created',
        message: ({ courseTitle }) => `${courseTitle || 'A course'} was created.`,
        priority: NOTIFICATION_PRIORITY.LOW
    },
    [NOTIFICATION_TYPE.COURSE_UPDATED]: {
        title: 'Course updated',
        message: ({ courseTitle }) => `${courseTitle || 'A course'} was updated.`,
        priority: NOTIFICATION_PRIORITY.NORMAL
    },
    [NOTIFICATION_TYPE.ANNOUNCEMENT_CREATED]: {
        title: 'New announcement',
        message: ({ announcementTitle, courseTitle }) => `${announcementTitle || 'An announcement'} was posted${courseTitle ? ` in ${courseTitle}` : ''}.`,
        priority: NOTIFICATION_PRIORITY.HIGH
    },
    [NOTIFICATION_TYPE.USER_PASSWORD_CHANGED]: {
        title: 'Password changed',
        message: () => 'Your Study Hero password was changed.',
        priority: NOTIFICATION_PRIORITY.CRITICAL
    },
    [NOTIFICATION_TYPE.SECURITY_LOGIN]: {
        title: 'New login',
        message: () => 'Your account was used to sign in.',
        priority: NOTIFICATION_PRIORITY.LOW
    },
    [NOTIFICATION_TYPE.SECURITY_LOGOUT]: {
        title: 'Logged out',
        message: () => 'Your account session was ended.',
        priority: NOTIFICATION_PRIORITY.LOW
    }
};

function buildNotificationCopy(type, data = {}) {
    const copy = NOTIFICATION_COPY[type] || {
        title: 'Study Hero update',
        message: () => 'There is a new update in Study Hero.',
        priority: NOTIFICATION_PRIORITY.NORMAL
    };

    return {
        title: copy.title,
        message: copy.message(data),
        priority: copy.priority
    };
}

module.exports = {
    NOTIFICATION_PRIORITY,
    NOTIFICATION_TYPE,
    NOTIFICATION_COPY,
    buildNotificationCopy
};
