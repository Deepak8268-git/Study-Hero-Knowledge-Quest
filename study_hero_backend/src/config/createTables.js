const db = require('./db');

async function createTables() {
    try {
        // Create users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('student', 'teacher', 'admin') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created successfully');

        // Create courses table
        await db.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                teacher_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users(id)
            )
        `);
        console.log('✅ Courses table created successfully');

        // Create enrollments table
        await db.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id INT PRIMARY KEY AUTO_INCREMENT,
                student_id INT,
                course_id INT,
                enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
                FOREIGN KEY (student_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            )
        `);
        console.log('✅ Enrollments table created successfully');

        // Create assignments table
        await db.query(`
            CREATE TABLE IF NOT EXISTS assignments (
                id INT PRIMARY KEY AUTO_INCREMENT,
                course_id INT,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                due_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id)
            )
        `);
        console.log('✅ Assignments table created successfully');

        // Create submissions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                assignment_no INT,
                student_id INT,
                submission_text TEXT,
                submission_file VARCHAR(255),
                grade DECIMAL(5,2),
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_no) REFERENCES assignments(id),
                FOREIGN KEY (student_id) REFERENCES users(id)
            )
        `);
        console.log('✅ Submissions table created successfully');

        console.log('🎉 All tables created successfully!');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    } finally {
        // Close the connection pool
        db.end();
    }
}

createTables(); 