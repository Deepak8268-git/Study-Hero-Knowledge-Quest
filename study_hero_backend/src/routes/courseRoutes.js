const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all courses
router.get('/', async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT c.*, u.username as teacher_name 
            FROM courses c 
            JOIN users u ON c.teacher_id = u.id
        `);
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get course by ID
router.get('/:id', async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT c.*, u.username as teacher_name 
            FROM courses c 
            JOIN users u ON c.teacher_id = u.id 
            WHERE c.id = ?
        `, [req.params.id]);
        
        if (courses.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        res.json(courses[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new course (teacher only)
router.post('/', async (req, res) => {
    try {
        const { title, description, teacher_id } = req.body;
        
        const [result] = await db.query(
            'INSERT INTO courses (title, description, teacher_id) VALUES (?, ?, ?)',
            [title, description, teacher_id]
        );
        
        res.status(201).json({ message: 'Course created successfully', courseId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update course (teacher only)
router.put('/:id', async (req, res) => {
    try {
        const { title, description } = req.body;
        
        await db.query(
            'UPDATE courses SET title = ?, description = ? WHERE id = ?',
            [title, description, req.params.id]
        );
        
        res.json({ message: 'Course updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete course (teacher only)
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 