const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const {
    signAccessToken,
    generateOpaqueToken,
    hashToken,
    addDays,
    addMinutes,
    getRefreshTokenDays,
    getRefreshCookieName,
    getRefreshCookieOptions,
    getAccessTokenTtl
} = require('../utils/tokens');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { sendVerificationEmail } = require('../services/emailService');
const { auditLog } = require('../services/auditService');
const { loginLimiter } = require('../middleware/rateLimiters');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: !!user.email_verified
    };
}

function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

function isLocked(user) {
    return user.locked_until && new Date(user.locked_until).getTime() > Date.now();
}

async function markFailedLogin(user, req) {
    const maxAttempts = Number(process.env.LOGIN_LOCKOUT_ATTEMPTS || 5);
    const lockoutMinutes = Number(process.env.LOGIN_LOCKOUT_MINUTES || 15);
    const attempts = Number(user.failed_login_attempts || 0) + 1;
    const lockedUntil = attempts >= maxAttempts ? addMinutes(lockoutMinutes) : null;

    await db.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockedUntil, user.id]);
    await auditLog({ userId: user.id, action: lockedUntil ? 'account_locked_legacy_users_route' : 'login_failed_legacy_users_route', ...getClientInfo(req) });
}

async function createLegacySession({ user, req, res }) {
    const refreshToken = generateOpaqueToken();
    const expiresAt = addDays(getRefreshTokenDays(false));
    await db.query(`
        INSERT INTO user_sessions (user_id, refresh_token_hash, remember_me, user_agent, ip_address, expires_at)
        VALUES (?, ?, false, ?, ?, ?)
    `, [user.id, hashToken(refreshToken), req.get('user-agent') || null, req.ip || null, expiresAt]);
    res.cookie(getRefreshCookieName(), refreshToken, getRefreshCookieOptions(expiresAt));
}

async function createLegacyVerification(user, req) {
    const verificationToken = generateOpaqueToken();
    const expiresAt = addMinutes(Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 1440));

    await db.query('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL', [user.id]);
    await db.query('INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, hashToken(verificationToken), expiresAt]);
    await db.query('UPDATE users SET verification_sent_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    await sendVerificationEmail({ to: user.email, username: user.username, token: verificationToken })
        .catch((emailError) => console.warn('Verification email skipped:', emailError.message));
    await auditLog({ userId: user.id, action: 'email_verification_sent_legacy_users_route', ...getClientInfo(req) });
}

// Register new user with role-specific fields
router.post('/register', async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            role,
            specialization,
            qualification,
            experience_years,
            bio,
            profile_picture,
            enrollment_number,
            department,
            semester,
            batch
        } = req.body;

        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

        if (!username || !normalizedEmail || !password || !role) {
            return res.status(400).json({ error: 'Username, email, password, and role are required' });
        }

        if (!['student', 'teacher'].includes(role)) {
            return res.status(400).json({ error: 'Role must be student or teacher' });
        }

        const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [normalizedEmail, username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const strength = validatePasswordStrength(password);
        if (!strength.valid) {
            return res.status(400).json({ error: 'Password does not meet security requirements', errors: strength.errors });
        }

        if (role === 'teacher' && (!specialization || !qualification)) {
            return res.status(400).json({ error: 'Specialization and qualification are required for teachers' });
        }

        if (role === 'student' && (!enrollment_number || !department || !semester)) {
            return res.status(400).json({ error: 'Enrollment number, department, and semester are required for students' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const [result] = await db.query(`
            INSERT INTO users (
                username, email, password, role,
                specialization, qualification, experience_years, bio, profile_picture,
                enrollment_number, department, semester, batch,
                email_verified, password_changed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, CURRENT_TIMESTAMP)
        `, [
            username, normalizedEmail, hashedPassword, role,
            specialization, qualification, experience_years, bio, profile_picture,
            enrollment_number, department, semester, batch
        ]);

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        const user = users[0];
        await createLegacyVerification(user, req);
        await auditLog({ userId: user.id, action: 'registered_legacy_users_route', ...getClientInfo(req) });

        res.status(201).json({
            message: 'User registered successfully',
            userId: result.insertId,
            requiresEmailVerification: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login user
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

        if (!normalizedEmail || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        if (isLocked(user)) {
            return res.status(423).json({ error: 'Account is temporarily locked. Please try again later.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await markFailedLogin(user, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const token = signAccessToken(user);
        await createLegacySession({ user, req, res });
        await auditLog({ userId: user.id, action: 'login_success_legacy_users_route', ...getClientInfo(req) });
        res.json({ token, accessToken: token, expiresIn: getAccessTokenTtl(), user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT
                id, username, email, role,
                specialization, qualification, experience_years, bio, profile_picture,
                enrollment_number, department, semester, batch
            FROM users
            WHERE id = ?
        `, [req.user.id]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const {
            username,
            email,
            specialization,
            qualification,
            experience_years,
            bio,
            profile_picture,
            enrollment_number,
            department,
            semester,
            batch
        } = req.body;

        await db.query(`
            UPDATE users
            SET
                username = ?,
                email = ?,
                specialization = ?,
                qualification = ?,
                experience_years = ?,
                bio = ?,
                profile_picture = ?,
                enrollment_number = ?,
                department = ?,
                semester = ?,
                batch = ?
            WHERE id = ?
        `, [
            username, email,
            specialization, qualification, experience_years, bio, profile_picture,
            enrollment_number, department, semester, batch,
            req.user.id
        ]);

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get teacher directory for authenticated users
router.get('/teachers', authMiddleware, async (req, res) => {
    try {
        const [teachers] = await db.query(`
            SELECT
                id, username,
                specialization, qualification, experience_years, bio, profile_picture
            FROM users
            WHERE role = 'teacher'
            ORDER BY username
        `);
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get students enrolled in the authenticated teacher's courses
router.get('/students', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const [students] = await db.query(`
            SELECT DISTINCT
                u.id, u.username, u.email,
                u.enrollment_number, u.department, u.semester, u.batch
            FROM users u
            JOIN enrollments e ON e.student_id = u.id AND e.status = 'active'
            JOIN courses c ON c.id = e.course_id
            WHERE u.role = 'student' AND c.teacher_id = ?
            ORDER BY u.username
        `, [req.user.id]);
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;