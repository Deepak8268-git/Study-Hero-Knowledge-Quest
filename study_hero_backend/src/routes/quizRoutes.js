const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db'); // your MySQL connection
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');

// POST: Generate and store quiz
router.post('/generate', authMiddleware, teacherMiddleware, async (req, res) => {
    const { context, course_id, assignment_id } = req.body;
    const teacher_id = req.user.id; // from auth middleware

    try {
        // 1. Call Mistral API
        const response = await axios.post(
            'https://api.mistral.ai/v1/chat/completions',
            {
                model: 'mistral-medium',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a quiz generator. Based on the context, create 5 MCQs with 4 options each and specify the correct answer.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const quizText = response.data.choices[0].message.content;

        // 2. Store in MySQL
        const [result] = await db.execute(
            `INSERT INTO quizzes (course_id, assignment_id, teacher_id, quiz_text) VALUES (?, ?, ?, ?)`,
            [course_id, assignment_id || null, teacher_id, quizText]
        );

        res.json({ message: 'Quiz generated and stored successfully', quiz_id: result.insertId, quiz: quizText });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Quiz generation or storage failed' });
    }
});

module.exports = router;
