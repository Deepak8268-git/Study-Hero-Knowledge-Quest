const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS
]
    .filter(Boolean)
    .flatMap(origin => origin.split(','))
    .map(origin => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);

if (!isProduction) {
    allowedOrigins.add('http://localhost:3000');
}

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));
app.use(express.json());

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
app.use('/api/quiz', quizRoutes);

const authRoutes = require('./src/routes/authRoutes');
app.use('/api/auth', authRoutes);

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);

// Default route
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Study Hero API'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err.message);

    if (err.message && err.message.startsWith('CORS blocked origin')) {
        return res.status(403).json({ error: 'CORS origin not allowed' });
    }

    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Available routes:');
    console.log('- POST /api/users/register');
    console.log('- POST /api/users/login');
    console.log('- GET /api/courses');
    console.log('- POST /api/courses');
    console.log('- GET /api/assignments/course/:courseId');
    console.log('- POST /api/assignments');
});
