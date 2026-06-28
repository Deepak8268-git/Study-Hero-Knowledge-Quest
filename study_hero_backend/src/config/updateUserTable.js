const db = require('./db');

async function updateUserTable() {
    try {
        // Add new columns for teacher-specific information
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS specialization VARCHAR(100),
            ADD COLUMN IF NOT EXISTS qualification VARCHAR(255),
            ADD COLUMN IF NOT EXISTS experience_years INT,
            ADD COLUMN IF NOT EXISTS bio TEXT,
            ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255)
        `);
        console.log('✅ Added teacher-specific columns');

        // Add new columns for student-specific information
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS enrollment_number VARCHAR(50) UNIQUE,
            ADD COLUMN IF NOT EXISTS department VARCHAR(100),
            ADD COLUMN IF NOT EXISTS semester INT,
            ADD COLUMN IF NOT EXISTS batch VARCHAR(50)
        `);
        console.log('✅ Added student-specific columns');

        console.log('🎉 User table updated successfully!');
    } catch (error) {
        console.error('❌ Error updating user table:', error);
    } finally {
        db.end();
    }
}

updateUserTable(); 