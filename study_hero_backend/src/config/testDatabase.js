const db = require('./db');

async function testDatabase() {
    try {
        console.log('🔍 Testing Database Connection...');
        
        // Test 1: Basic Connection
        const [result] = await db.query('SELECT 1');
        console.log('✅ Test 1: Basic connection successful');
        
        // Test 2: Check Tables
        console.log('\n📊 Checking Database Tables...');
        const [tables] = await db.query('SHOW TABLES');
        console.log('Found tables:', tables.map(t => t[`Tables_in_${process.env.DB_NAME}`]));
        
        // Test 3: Check Users Table
        console.log('\n👥 Checking Users Table...');
        const [users] = await db.query('SELECT COUNT(*) as count FROM users');
        console.log(`Users count: ${users[0].count}`);
        
        // Test 4: Check Courses Table
        console.log('\n📚 Checking Courses Table...');
        const [courses] = await db.query('SELECT COUNT(*) as count FROM courses');
        console.log(`Courses count: ${courses[0].count}`);
        
        // Test 5: Check Enrollments Table
        console.log('\n🎓 Checking Enrollments Table...');
        const [enrollments] = await db.query('SELECT COUNT(*) as count FROM enrollments');
        console.log(`Enrollments count: ${enrollments[0].count}`);
        
        // Test 6: Check Assignments Table
        console.log('\n📝 Checking Assignments Table...');
        const [assignments] = await db.query('SELECT COUNT(*) as count FROM assignments');
        console.log(`Assignments count: ${assignments[0].count}`);
        
        // Test 7: Check Submissions Table
        console.log('\n📤 Checking Submissions Table...');
        const [submissions] = await db.query('SELECT COUNT(*) as count FROM submissions');
        console.log(`Submissions count: ${submissions[0].count}`);
        
        // Test 8: Check Foreign Key Relationships
        console.log('\n🔗 Checking Foreign Key Relationships...');
        try {
            // Try to insert invalid data
            await db.query('INSERT INTO enrollments (student_id, course_id) VALUES (999, 999)');
            console.log('❌ Foreign key constraints not working properly');
        } catch (error) {
            console.log('✅ Foreign key constraints working properly');
        }
        
        console.log('\n🎉 Database Test Complete!');
        
    } catch (error) {
        console.error('❌ Error during database test:', error);
    } finally {
        db.end();
    }
}

testDatabase(); 