const db = require('./db');

async function disabledSeeder() {
    console.log('Data seeding is disabled. Create production users, courses, enrollments, assignments, and quizzes through the application APIs.');
    await db.end();
}

disabledSeeder().catch(async (error) => {
    console.error('Seeder shutdown error:', error.message);
    await db.end();
    process.exit(1);
});