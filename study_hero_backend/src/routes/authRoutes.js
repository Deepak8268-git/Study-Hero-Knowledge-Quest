const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { loginLimiter, passwordResetLimiter, verificationLimiter } = require('../middleware/rateLimiters');
const eventBus = require('../events/eventBus');
const EVENTS = require('../events/eventNames');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const {
    signAccessToken,
    generateOpaqueToken,
    hashToken,
    addDays,
    addMinutes,
    getAccessTokenTtl,
    getRefreshTokenDays,
    getRefreshCookieName,
    getRefreshCookieOptions
} = require('../utils/tokens');

const router = express.Router();

const registerSchema = z.object({
    body: z.object({
        username: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(150).transform((value) => value.toLowerCase()),
        password: z.string().min(1),
        role: z.enum(['student', 'teacher']).optional(),
        instituteId: z.number().int().positive().optional().nullable(),
        departmentId: z.number().int().positive().optional().nullable(),
        programId: z.number().int().positive().optional().nullable(),
        semesterId: z.number().int().positive().optional().nullable(),
        batchId: z.number().int().positive().optional().nullable()
    })
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().email().transform((value) => value.toLowerCase()),
        password: z.string().min(1),
        rememberMe: z.boolean().optional()
    })
});

const emailSchema = z.object({
    body: z.object({
        email: z.string().trim().email().transform((value) => value.toLowerCase())
    })
});

const tokenBodySchema = z.object({
    body: z.object({
        token: z.string().min(20)
    })
});

const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(20),
        password: z.string().min(1)
    })
});

const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(1)
    })
});

function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: !!user.email_verified,
        instituteId: user.institute_id || null,
        departmentId: user.department_id || null,
        programId: user.program_id || null,
        semesterId: user.semester_id || null,
        batchId: user.batch_id || null
    };
}

function setRefreshCookie(res, refreshToken, expiresAt) {
    res.cookie(getRefreshCookieName(), refreshToken, getRefreshCookieOptions(expiresAt));
}

function clearRefreshCookie(res) {
    res.clearCookie(getRefreshCookieName(), {
        ...getRefreshCookieOptions(new Date(0)),
        expires: undefined
    });
}

async function createSession({ user, rememberMe, req, res }) {
    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = addDays(getRefreshTokenDays(rememberMe));
    const { ipAddress, userAgent } = getClientInfo(req);

    const [result] = await db.query(`
        INSERT INTO user_sessions (user_id, refresh_token_hash, remember_me, user_agent, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [user.id, refreshTokenHash, !!rememberMe, userAgent, ipAddress, expiresAt]);

    setRefreshCookie(res, refreshToken, expiresAt);
    return { refreshToken, refreshTokenHash, sessionId: result.insertId, expiresAt };
}

async function createEmailVerification({ user, req }) {
    const token = generateOpaqueToken();
    const tokenHash = hashToken(token);
    const expiresAt = addMinutes(Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 1440));

    await db.query('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL', [user.id]);
    await db.query(`
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
    `, [user.id, tokenHash, expiresAt]);
    await db.query('UPDATE users SET verification_sent_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    return token;
}

async function markFailedLogin(user, req) {
    const maxAttempts = Number(process.env.LOGIN_LOCKOUT_ATTEMPTS || 5);
    const lockoutMinutes = Number(process.env.LOGIN_LOCKOUT_MINUTES || 15);
    const attempts = Number(user.failed_login_attempts || 0) + 1;
    const lockedUntil = attempts >= maxAttempts ? addMinutes(lockoutMinutes) : null;

    await db.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockedUntil, user.id]);
    eventBus.emitDomain(EVENTS.SECURITY_LOGIN_FAILED, {
        userId: user.id,
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
        auditMetadata: { locked: !!lockedUntil },
        ...getClientInfo(req)
    });
}

function isLocked(user) {
    return user.locked_until && new Date(user.locked_until).getTime() > Date.now();
}

router.post('/register', validateRequest(registerSchema), async (req, res) => {
    try {
        const { username, email, password, role, instituteId, departmentId, programId, semesterId, batchId } = req.validated.body;
        const selectedRole = role || 'student';
        const strength = validatePasswordStrength(password);

        if (!strength.valid) {
            return res.status(400).json({ message: 'Password does not meet security requirements', errors: strength.errors });
        }

        const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const [result] = await db.query(`
            INSERT INTO users (username, email, password, role, institute_id, department_id, program_id, semester_id, batch_id, email_verified, password_changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, CURRENT_TIMESTAMP)
        `, [username, email, hashedPassword, selectedRole, instituteId || null, departmentId || null, programId || null, semesterId || null, batchId || null]);

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        const user = users[0];
        const verificationToken = await createEmailVerification({ user, req });
        eventBus.emitDomain(EVENTS.USER_REGISTERED, {
            userId: user.id,
            actorId: user.id,
            user,
            verificationToken,
            entityType: 'user',
            entityId: user.id,
            ...getClientInfo(req)
        });

        res.status(201).json({
            message: 'User registered successfully. Please verify your email address.',
            requiresEmailVerification: true
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', loginLimiter, validateRequest(loginSchema), async (req, res) => {
    try {
        const { email, password, rememberMe = false } = req.validated.body;

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = users[0];
        if (isLocked(user)) {
            return res.status(423).json({ message: 'Account is temporarily locked. Please try again later.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await markFailedLogin(user, req);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const accessToken = signAccessToken(user);
        await createSession({ user, rememberMe, req, res });
        eventBus.emitDomain(EVENTS.SECURITY_LOGIN, {
            userId: user.id,
            actorId: user.id,
            entityType: 'user',
            entityId: user.id,
            auditMetadata: { rememberMe },
            ...getClientInfo(req)
        });

        res.json({
            token: accessToken,
            accessToken,
            expiresIn: getAccessTokenTtl(),
            user: publicUser(user)
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.[getRefreshCookieName()] || req.body?.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const refreshTokenHash = hashToken(refreshToken);
        const [sessions] = await db.query(`
            SELECT s.*, u.id AS user_id, u.username, u.email, u.role, u.institute_id, u.department_id, u.program_id, u.semester_id, u.batch_id, u.email_verified, u.password_changed_at
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.refresh_token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
        `, [refreshTokenHash]);

        if (sessions.length === 0) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const session = sessions[0];
        await db.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);

        const user = {
            id: session.user_id,
            username: session.username,
            email: session.email,
            role: session.role,
            institute_id: session.institute_id,
            department_id: session.department_id,
            program_id: session.program_id,
            semester_id: session.semester_id,
            batch_id: session.batch_id,
            email_verified: session.email_verified,
            password_changed_at: session.password_changed_at
        };

        const accessToken = signAccessToken(user);
        await createSession({ user, rememberMe: !!session.remember_me, req, res });
        eventBus.emitDomain(EVENTS.SECURITY_TOKEN_REFRESHED, {
            userId: user.id,
            actorId: user.id,
            entityType: 'user_session',
            entityId: session.id,
            ...getClientInfo(req)
        });

        res.json({ token: accessToken, accessToken, expiresIn: getAccessTokenTtl(), user: publicUser(user) });
    } catch (error) {
        console.error('Refresh error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const refreshToken = req.cookies?.[getRefreshCookieName()] || req.body?.refreshToken;
        if (refreshToken) {
            const refreshTokenHash = hashToken(refreshToken);
            const [sessions] = await db.query('SELECT id, user_id FROM user_sessions WHERE refresh_token_hash = ?', [refreshTokenHash]);
            await db.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = ?', [refreshTokenHash]);
            if (sessions.length > 0) {
                eventBus.emitDomain(EVENTS.SECURITY_LOGOUT, {
                    userId: sessions[0].user_id,
                    actorId: sessions[0].user_id,
                    entityType: 'user_session',
                    entityId: sessions[0].id,
                    ...getClientInfo(req)
                });
            }
        }
        clearRefreshCookie(res);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/logout-all', authMiddleware, async (req, res) => {
    try {
        await db.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [req.user.id]);
        clearRefreshCookie(res);
        eventBus.emitDomain(EVENTS.SECURITY_LOGOUT, {
            userId: req.user.id,
            actorId: req.user.id,
            entityType: 'user_session',
            entityId: req.user.id,
            auditMetadata: { allDevices: true },
            ...getClientInfo(req)
        });
        res.json({ message: 'Logged out from all devices' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    const [users] = await db.query('SELECT id, username, email, role, institute_id, department_id, program_id, semester_id, batch_id, email_verified FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(users[0]));
});

router.post('/forgot-password', passwordResetLimiter, validateRequest(emailSchema), async (req, res) => {
    try {
        const { email } = req.validated.body;
        const [users] = await db.query('SELECT id, username, email FROM users WHERE email = ?', [email]);

        if (users.length > 0) {
            const user = users[0];
            const token = generateOpaqueToken();
            await db.query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL', [user.id]);
            await db.query(`
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (?, ?, ?)
            `, [user.id, hashToken(token), addMinutes(Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 60))]);
            eventBus.emitDomain(EVENTS.USER_PASSWORD_RESET_REQUESTED, {
                userId: user.id,
                actorId: user.id,
                user,
                resetToken: token,
                entityType: 'user',
                entityId: user.id,
                ...getClientInfo(req)
            });
        }

        res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/reset-password', passwordResetLimiter, validateRequest(resetPasswordSchema), async (req, res) => {
    try {
        const { token, password } = req.validated.body;
        const strength = validatePasswordStrength(password);
        if (!strength.valid) {
            return res.status(400).json({ message: 'Password does not meet security requirements', errors: strength.errors });
        }

        const [tokens] = await db.query(`
            SELECT prt.*, u.id AS user_id
            FROM password_reset_tokens prt
            JOIN users u ON u.id = prt.user_id
            WHERE prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > CURRENT_TIMESTAMP
        `, [hashToken(token)]);

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const record = tokens[0];
        const hashedPassword = await bcrypt.hash(password, 12);
        await db.query('UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [hashedPassword, record.user_id]);
        await db.query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
        await db.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?', [record.user_id]);
        const [changedUsers] = await db.query('SELECT id, username, email FROM users WHERE id = ?', [record.user_id]);
        eventBus.emitDomain(EVENTS.USER_PASSWORD_CHANGED, {
            userId: record.user_id,
            actorId: record.user_id,
            user: changedUsers[0],
            entityType: 'user',
            entityId: record.user_id,
            auditMetadata: { reset: true },
            ...getClientInfo(req)
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/change-password', authMiddleware, validateRequest(changePasswordSchema), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.validated.body;
        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            return res.status(400).json({ message: 'Password does not meet security requirements', errors: strength.errors });
        }

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(currentPassword, users[0].password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, req.user.id]);
        await db.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.user.id]);
        clearRefreshCookie(res);
        eventBus.emitDomain(EVENTS.USER_PASSWORD_CHANGED, {
            userId: req.user.id,
            actorId: req.user.id,
            user: users[0],
            entityType: 'user',
            entityId: req.user.id,
            ...getClientInfo(req)
        });

        res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (error) {
        console.error('Change password error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/verify-email', verificationLimiter, validateRequest(tokenBodySchema), async (req, res) => {
    try {
        const { token } = req.validated.body;
        const [tokens] = await db.query(`
            SELECT evt.*, u.id AS user_id
            FROM email_verification_tokens evt
            JOIN users u ON u.id = evt.user_id
            WHERE evt.token_hash = ? AND evt.used_at IS NULL AND evt.expires_at > CURRENT_TIMESTAMP
        `, [hashToken(token)]);

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const record = tokens[0];
        await db.query('UPDATE users SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?', [record.user_id]);
        await db.query('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
        eventBus.emitDomain(EVENTS.USER_EMAIL_VERIFIED, {
            userId: record.user_id,
            actorId: record.user_id,
            entityType: 'user',
            entityId: record.user_id,
            ...getClientInfo(req)
        });

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('Verify email error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/resend-verification', verificationLimiter, validateRequest(emailSchema), async (req, res) => {
    try {
        const { email } = req.validated.body;
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.json({ message: 'If the account needs verification, a new email has been sent.' });
        }

        const user = users[0];
        if (user.email_verified) {
            return res.json({ message: 'Email is already verified.' });
        }

        const cooldownMinutes = Number(process.env.VERIFICATION_RESEND_COOLDOWN_MINUTES || 5);
        if (user.verification_sent_at && Date.now() - new Date(user.verification_sent_at).getTime() < cooldownMinutes * 60 * 1000) {
            return res.status(429).json({ error: 'Please wait before requesting another verification email.' });
        }

        const verificationToken = await createEmailVerification({ user, req });
        eventBus.emitDomain(EVENTS.USER_VERIFICATION_REQUESTED, {
            userId: user.id,
            actorId: user.id,
            user,
            verificationToken,
            entityType: 'user',
            entityId: user.id,
            ...getClientInfo(req)
        });
        res.json({ message: 'Verification email sent.' });
    } catch (error) {
        console.error('Resend verification error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

function getPublicBackendUrl(req) {
    return process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
}

function getFrontendUrl() {
    return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
}

function getOAuthConfig(provider, req) {
    const callbackBase = getPublicBackendUrl(req);
    const configs = {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${callbackBase}/api/auth/oauth/google/callback`,
            authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
            scope: 'openid email profile'
        },
        facebook: {
            clientId: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackUrl: process.env.FACEBOOK_CALLBACK_URL || `${callbackBase}/api/auth/oauth/facebook/callback`,
            authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
            tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
            userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email',
            scope: 'email,public_profile'
        }
    };

    return configs[provider];
}

function signOAuthState(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || '').update(body).digest('base64url');
    return `${body}.${signature}`;
}

function readOAuthState(state) {
    if (!state || !process.env.JWT_SECRET) return null;
    const [body, signature] = String(state).split('.');
    if (!body || !signature) return null;
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
}

function redirectOAuthError(res, message) {
    const target = `${getFrontendUrl()}/oauth/callback#error=${encodeURIComponent(message)}`;
    return res.redirect(target);
}

function normalizeOAuthProfile(provider, data) {
    if (provider === 'google') {
        return {
            email: data.email,
            username: data.name || data.email?.split('@')[0],
            providerId: data.sub
        };
    }

    return {
        email: data.email,
        username: data.name || data.email?.split('@')[0],
        providerId: data.id
    };
}

async function uniqueOAuthUsername(baseName) {
    const normalized = String(baseName || 'studyhero-user').trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'studyhero-user';
    let candidate = normalized;
    let suffix = 0;

    while (true) {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [candidate]);
        if (existing.length === 0) return candidate;
        suffix += 1;
        candidate = `${normalized.slice(0, 70)}-${suffix}`;
    }
}

async function findOrCreateOAuthUser({ provider, profile, role }) {
    const email = String(profile.email || '').toLowerCase();
    if (!email) {
        const error = new Error(`${provider} account did not provide an email address`);
        error.statusCode = 400;
        throw error;
    }

    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
        return { user: existing[0], created: false };
    }

    const username = await uniqueOAuthUsername(profile.username || email.split('@')[0]);
    const randomPassword = await bcrypt.hash(generateOpaqueToken(), 12);
    const selectedRole = role === 'teacher' ? 'teacher' : 'student';
    const [result] = await db.query(`
        INSERT INTO users (username, email, password, role, email_verified, email_verified_at, password_changed_at)
        VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [username, email, randomPassword, selectedRole]);

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return { user: users[0], created: true };
}

router.get('/oauth/:provider/start', async (req, res) => {
    try {
        const provider = String(req.params.provider || '').toLowerCase();
        const config = getOAuthConfig(provider, req);
        if (!config) return res.status(404).json({ error: 'OAuth provider not supported' });
        if (!config.clientId || !config.clientSecret) {
            return res.status(501).json({ error: `${provider} OAuth is not configured` });
        }

        const role = req.query.role === 'teacher' ? 'teacher' : 'student';
        const state = signOAuthState({ role, provider, exp: Date.now() + 10 * 60 * 1000, nonce: generateOpaqueToken() });
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.callbackUrl,
            response_type: 'code',
            scope: config.scope,
            state
        });

        res.redirect(`${config.authorizeUrl}?${params.toString()}`);
    } catch (error) {
        console.error('OAuth start error:', error.message);
        res.status(500).json({ error: 'Unable to start OAuth sign in' });
    }
});

router.get('/oauth/:provider/callback', async (req, res) => {
    try {
        const provider = String(req.params.provider || '').toLowerCase();
        const config = getOAuthConfig(provider, req);
        if (!config) return redirectOAuthError(res, 'OAuth provider not supported');
        if (req.query.error) return redirectOAuthError(res, String(req.query.error));

        const state = readOAuthState(req.query.state);
        if (!state || state.provider !== provider) return redirectOAuthError(res, 'Invalid OAuth state');
        if (!req.query.code) return redirectOAuthError(res, 'Missing OAuth authorization code');

        let tokenResponse;
        if (provider === 'google') {
            tokenResponse = await axios.post(config.tokenUrl, new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: String(req.query.code),
                grant_type: 'authorization_code',
                redirect_uri: config.callbackUrl
            }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        } else {
            tokenResponse = await axios.get(config.tokenUrl, {
                params: {
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    code: String(req.query.code),
                    redirect_uri: config.callbackUrl
                }
            });
        }

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) return redirectOAuthError(res, 'OAuth access token was not returned');

        const userInfoResponse = await axios.get(config.userInfoUrl, {
            headers: provider === 'google' ? { Authorization: `Bearer ${accessToken}` } : undefined,
            params: provider === 'facebook' ? { access_token: accessToken } : undefined
        });

        const profile = normalizeOAuthProfile(provider, userInfoResponse.data);
        const { user, created } = await findOrCreateOAuthUser({ provider, profile, role: state.role });
        await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const appAccessToken = signAccessToken(user);
        await createSession({ user, rememberMe: true, req, res });
        eventBus.emitDomain(EVENTS.SECURITY_LOGIN, {
            userId: user.id,
            actorId: user.id,
            entityType: 'user',
            entityId: user.id,
            auditMetadata: { provider, oauth: true, created },
            ...getClientInfo(req)
        });

        const redirectUrl = `${getFrontendUrl()}/oauth/callback#token=${encodeURIComponent(appAccessToken)}&role=${encodeURIComponent(user.role)}`;
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('OAuth callback error:', error.response?.data || error.message);
        redirectOAuthError(res, 'OAuth sign in failed');
    }
});
module.exports = router;

