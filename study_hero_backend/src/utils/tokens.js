const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function getAccessTokenTtl() {
    return process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
}

function getRefreshTokenDays(rememberMe = false) {
    const value = rememberMe
        ? (process.env.REFRESH_TOKEN_REMEMBER_DAYS || process.env.REMEMBER_ME_REFRESH_TOKEN_DAYS)
        : process.env.REFRESH_TOKEN_DAYS;
    return Number(value || (rememberMe ? 30 : 7));
}

function signAccessToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT secret is not configured');
    }

    return jwt.sign(
        {
            userId: user.id,
            role: user.role,
            pwd: user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0
        },
        process.env.JWT_SECRET,
        { expiresIn: getAccessTokenTtl() }
    );
}

function generateOpaqueToken() {
    return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function addDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}

function addMinutes(minutes) {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date;
}

function getRefreshCookieName() {
    return process.env.REFRESH_COOKIE_NAME || 'study_hero_refresh';
}

function getRefreshCookieOptions(expiresAt) {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: process.env.REFRESH_COOKIE_SECURE ? process.env.REFRESH_COOKIE_SECURE === 'true' : isProduction,
        sameSite: process.env.REFRESH_COOKIE_SAMESITE || process.env.REFRESH_COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
        expires: expiresAt,
        path: '/api/auth'
    };
}

module.exports = {
    signAccessToken,
    generateOpaqueToken,
    hashToken,
    addDays,
    addMinutes,
    getAccessTokenTtl,
    getRefreshTokenDays,
    getRefreshCookieName,
    getRefreshCookieOptions
};
