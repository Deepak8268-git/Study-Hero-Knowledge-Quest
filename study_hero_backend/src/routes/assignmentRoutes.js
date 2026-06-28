const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');

// Get all assignments for a course
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const [assignments] = await db.query(`
            SELECT a.*, c.title as course_title 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.course_id = ?
        `, [req.params.courseId]);
        
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a single assignment
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const [assignments] = await db.query(`
            SELECT a.*, c.title as course_title 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?
        `, [req.params.id]);
        
        if (assignments.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        res.json(assignments[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new assignment (teacher only)
router.post('/', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { course_id, title, description, due_date } = req.body;
        
        // Verify teacher owns the course
        const [courses] = await db.query(
            'SELECT teacher_id FROM courses WHERE id = ?',
            [course_id]
        );
        
        if (courses.length === 0 || courses[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to create assignments for this course' });
        }
        
        const [result] = await db.query(`
            INSERT INTO assignments (course_id, title, description, due_date)
            VALUES (?, ?, ?, ?)
        `, [course_id, title, description, due_date]);
        
        res.status(201).json({ 
            message: 'Assignment created successfully',
            assignmentId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update assignment (teacher only)
router.put('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        const { title, description, due_date } = req.body;
        
        // Verify teacher owns the assignment
        const [assignments] = await db.query(`
            SELECT c.teacher_id 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?
        `, [req.params.id]);
        
        if (assignments.length === 0 || assignments[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to update this assignment' });
        }
        
        await db.query(`
            UPDATE assignments 
            SET title = ?, description = ?, due_date = ?
            WHERE id = ?
        `, [title, description, due_date, req.params.id]);
        
        res.json({ message: 'Assignment updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete assignment (teacher only)
router.delete('/:id', authMiddleware, teacherMiddleware, async (req, res) => {
    try {
        // Verify teacher owns the assignment
        const [assignments] = await db.query(`
            SELECT c.teacher_id 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?
        `, [req.params.id]);
        
        if (assignments.length === 0 || assignments[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this assignment' });
        }
        
        await db.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 