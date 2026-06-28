const mysql = require('mysql2');
require('dotenv').config();

console.log('Attempting to connect with these credentials:');
console.log('Host:', process.env.DB_HOST);
console.log('Port:', process.env.DB_PORT);
console.log('User:', process.env.DB_USER);
console.log('Database:', process.env.DB_NAME);

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        console.error('❌ Connection Error:', err);
        return;
    }
    console.log('✅ Connected to MySQL successfully!');
    
    // Test query
    connection.query('SELECT 1', (err, results) => {
        if (err) {
            console.error('❌ Query Error:', err);
            return;
        }
        console.log('✅ Test query successful:', results);
        connection.end();
    });
}); 