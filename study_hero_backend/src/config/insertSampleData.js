const db = require('./db');

async function insertSampleData() {
    try {
        // Insert sample users
        const [userResult] = await db.query(`
            INSERT INTO users (username, email, password, role) VALUES 
            ('admin', 'admin@studyhero.com', '$2b$10$exampleHash', 'admin'),
            ('teacher1', 'teacher1@studyhero.com', '$2b$10$exampleHash', 'teacher'),
            ('student1', 'student1@studyhero.com', '$2b$10$exampleHash', 'student'),
            ('student2', 'student2@studyhero.com', '$2b$10$exampleHash', 'student')
        `);
        console.log('✅ Sample users inserted');

        // Insert sample courses
        const [courseResult] = await db.query(`
            INSERT INTO courses (title, description, teacher_id) VALUES 
            ('Web Development', 'Learn HTML, CSS, and JavaScript', 2),
            ('Database Management', 'Learn SQL and Database Design', 2)
        `);
        console.log('✅ Sample courses inserted');

        // Insert sample enrollments
        await db.query(`
            INSERT INTO enrollments (student_id, course_id) VALUES 
            (3, 1),
            (3, 2),
            (4, 1)
        `);
        console.log('✅ Sample enrollments inserted');

        // Insert sample assignments
        await db.query(`
            INSERT INTO assignments (course_id, title, description, due_date) VALUES 
            (1, 'HTML Basics', 'Create a simple HTML page', NOW() + INTERVAL 7 DAY),
            (1, 'CSS Styling', 'Style your HTML page with CSS', NOW() + INTERVAL 14 DAY),
            (2, 'SQL Queries', 'Write basic SQL queries', NOW() + INTERVAL 10 DAY)
        `);
        console.log('✅ Sample assignments inserted');

        // Insert sample submissions
        await db.query(`
            INSERT INTO submissions (assignment_no, student_id, submission_text, grade) VALUES 
            (1, 3, 'Completed HTML assignment', 85.5),
            (2, 3, 'Completed CSS assignment', 92.0),
            (3, 4, 'Completed SQL assignment', 78.5)
        `);
        console.log('✅ Sample submissions inserted');

        console.log('🎉 All sample data inserted successfully!');
    } catch (error) {
        console.error('❌ Error inserting sample data:', error);
    } finally {
        db.end();
    }
}

insertSampleData(); 