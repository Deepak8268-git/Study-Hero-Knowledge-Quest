const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/authMiddleware');

// Register new user with role-specific fields
router.post('/register', async (req, res) => {
    try {
        const { 
            username, 
            email, 
            password, 
            role,
            // Teacher specific fields
            specialization,
            qualification,
            experience_years,
            bio,
            profile_picture,
            // Student specific fields
            enrollment_number,
            department,
            semester,
            batch
        } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Validate role-specific fields
        if (role === 'teacher' && (!specialization || !qualification)) {
            return res.status(400).json({ error: 'Specialization and qualification are required for teachers' });
        }
        
        if (role === 'student' && (!enrollment_number || !department || !semester)) {
            return res.status(400).json({ error: 'Enrollment number, department, and semester are required for students' });
        }

        const [result] = await db.query(`
            INSERT INTO users (
                username, email, password, role,
                specialization, qualification, experience_years, bio, profile_picture,
                enrollment_number, department, semester, batch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            username, email, hashedPassword, role,
            specialization, qualification, experience_years, bio, profile_picture,
            enrollment_number, department, semester, batch
        ]);
        
        res.status(201).json({ 
            message: 'User registered successfully', 
            userId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'JWT secret is not configured' });
        }

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Remove password from response
        delete user.password;
        
        res.json({ token, user });
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

// Get all teachers
router.get('/teachers', async (req, res) => {
    try {
        const [teachers] = await db.query(`
            SELECT 
                id, username, email,
                specialization, qualification, experience_years, bio, profile_picture
            FROM users 
            WHERE role = 'teacher'
        `);
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all students
router.get('/students', async (req, res) => {
    try {
        const [students] = await db.query(`
            SELECT 
                id, username, email,
                enrollment_number, department, semester, batch
            FROM users 
            WHERE role = 'student'
        `);
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 
