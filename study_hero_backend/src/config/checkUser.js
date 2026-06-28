const db = require('./db');

async function checkUser() {
    try {
        console.log('🔍 Searching for Omkar Naik in the database...');
        
        // Search in users table
        const [users] = await db.query(`
            SELECT * FROM users 
            WHERE username LIKE '%Omkar%' 
            OR username LIKE '%Naik%'
            OR email LIKE '%Omkar%'
            OR email LIKE '%Naik%'
        `);
        
        if (users.length > 0) {
            console.log('\n✅ Found matching user(s):');
            users.forEach(user => {
                console.log(`- ID: ${user.id}`);
                console.log(`  Username: ${user.username}`);
                console.log(`  Email: ${user.email}`);
                console.log(`  Password: ${user.password}`);
                console.log(`  Role: ${user.role}`);
            }); 
        } else {
            console.log('\n❌ No user found with name "Omkar Naik"');
        }
        
        // Also check in any other relevant tables
        console.log('\n🔍 Checking other tables for references...');
        
        // Check courses table
        const [courses] = await db.query(`
            SELECT c.*, u.username as teacher_name 
            FROM courses c
            JOIN users u ON c.teacher_id = u.id
            WHERE u.username LIKE '%Omkar%' 
            OR u.username LIKE '%Naik%'
        `);
        
        if (courses.length > 0) {
            console.log('\n📚 Found courses taught by matching teacher:');
            courses.forEach(course => {
                console.log(`- Course: ${course.title}`);
                console.log(`  Teacher: ${course.teacher_name}`);
            });
        }
        
        // Check enrollments
        const [enrollments] = await db.query(`
            SELECT e.*, u.username as student_name, c.title as course_title
            FROM enrollments e
            JOIN users u ON e.student_id = u.id
            JOIN courses c ON e.course_id = c.id
            WHERE u.username LIKE '%Omkar%' 
            OR u.username LIKE '%Naik%'
        `);
        
        if (enrollments.length > 0) {
            console.log('\n🎓 Found enrollments for matching student:');
            enrollments.forEach(enrollment => {
                console.log(`- Student: ${enrollment.student_name}`);
                console.log(`  Course: ${enrollment.course_title}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error during search:', error);
    } finally {
        db.end();
    }
}

checkUser(); 