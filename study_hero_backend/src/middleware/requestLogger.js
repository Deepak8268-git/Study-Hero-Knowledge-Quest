function requestLogger(req, res, next) {
    const started = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - started;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
}

module.exports = requestLogger;