const db = require('../config/db');

async function auditLog({ userId = null, action, entityType = 'auth', entityId = null, ipAddress = null, userAgent = null, metadata = null }) {
    try {
        await db.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, action, entityType, entityId, ipAddress, userAgent, metadata ? JSON.stringify(metadata) : null]);
    } catch (error) {
        console.error('Audit log error:', error.message);
    }
}

module.exports = { auditLog };