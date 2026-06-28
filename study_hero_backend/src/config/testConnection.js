const db = require('./db');

async function testConnection() {
    try {
        const [rows] = await db.query('SELECT 1');
        console.log('✅ MySQL Connection Test Successful!');
        console.log('Test Query Result:', rows);
    } catch (error) {
        console.error('❌ MySQL Connection Test Failed:', error);
    } finally {
        // Close the connection pool
        db.end();
    }
}

testConnection(); 