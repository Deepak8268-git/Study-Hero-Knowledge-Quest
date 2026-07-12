const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const ensureCommercialSchema = require('./src/config/ensureCommercialSchema');
const eventBus = require('./src/events/eventBus');
const registerEventListeners = require('./src/events/registerEventListeners');
const { initializeSocketServer } = require('./src/socket/socketServer');
const requestLogger = require('./src/middleware/requestLogger');
const { authLimiter } = require('./src/middleware/rateLimiters');

const app = express();
app.set('trust proxy', 1);
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
app.use(helmet());
app.use(requestLogger);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const announcementRoutes = require('./src/routes/announcementRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const lmsRoutes = require('./src/routes/lmsRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const performanceRoutes = require('./src/routes/performanceRoutes');
app.use('/api/quiz', quizRoutes);
app.use('/api/dashboard', dashboardRoutes);

const authRoutes = require('./src/routes/authRoutes');
app.use('/api/auth', authLimiter, authRoutes);

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/performance', performanceRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Study Hero API',
        timestamp: new Date().toISOString()
    });
});
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
const httpServer = http.createServer(app);
initializeSocketServer(httpServer, allowedOrigins);
registerEventListeners(eventBus);

async function startServer() {
    try {
        await ensureCommercialSchema();

        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('Available routes:');
            console.log('- POST /api/users/register');
            console.log('- POST /api/users/login');
            console.log('- GET /api/courses');
            console.log('- POST /api/courses');
            console.log('- GET /api/assignments/course/:courseId');
            console.log('- POST /api/assignments');
            console.log('- GET /api/dashboard/teacher');
            console.log('- GET /api/dashboard/student');
            console.log('- GET /api/quiz/:id');
            console.log('- POST /api/quiz/:id/attempts');
            console.log('- GET /api/notifications');
            console.log('- POST /api/announcements');
            console.log('- POST /api/ai/assistant/chat');
            console.log('- GET /api/lms/timetable');
            console.log('- GET /api/analytics/teacher');
            console.log('- GET /api/analytics/student');
            console.log('- GET /api/performance/student');
            console.log('- GET /api/performance/teacher');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();


