const EVENTS = {
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
    USER_VERIFICATION_REQUESTED: 'user.verification_requested',
    USER_EMAIL_VERIFIED: 'user.email_verified',
    USER_PASSWORD_CHANGED: 'user.password_changed',
    USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
    SECURITY_LOGIN_FAILED: 'security.login_failed',
    SECURITY_TOKEN_REFRESHED: 'security.token_refreshed',
    SECURITY_LOGIN: 'security.login',
    SECURITY_LOGOUT: 'security.logout',
    AI_OPERATION_COMPLETED: 'ai.operation_completed',
    LMS_OPERATION_COMPLETED: 'lms.operation_completed'
};

module.exports = EVENTS;
