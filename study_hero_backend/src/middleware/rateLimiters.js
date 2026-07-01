const rateLimit = require('express-rate-limit');

function makeLimiter({ windowMinutes, max, message }) {
    return rateLimit({
        windowMs: Number(windowMinutes) * 60 * 1000,
        max: Number(max),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message }
    });
}

const authLimiter = makeLimiter({
    windowMinutes: process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || 15,
    max: process.env.AUTH_RATE_LIMIT_MAX || 50,
    message: 'Too many authentication requests. Please try again later.'
});

const loginLimiter = makeLimiter({
    windowMinutes: process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 15,
    max: process.env.LOGIN_RATE_LIMIT_MAX || 10,
    message: 'Too many login attempts. Please try again later.'
});

const passwordResetLimiter = makeLimiter({
    windowMinutes: process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES || 15,
    max: process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 5,
    message: 'Too many password reset requests. Please try again later.'
});

const verificationLimiter = makeLimiter({
    windowMinutes: process.env.VERIFICATION_RATE_LIMIT_WINDOW_MINUTES || 15,
    max: process.env.VERIFICATION_RATE_LIMIT_MAX || 5,
    message: 'Too many verification requests. Please try again later.'
});

module.exports = {
    authLimiter,
    loginLimiter,
    passwordResetLimiter,
    verificationLimiter
};