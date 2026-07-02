const db = require('./db');

async function ensureColumn(tableName, columnName, definition) {
    const [columns] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
    if (columns.length === 0) {
        await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

async function ensureCommercialSchema() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
            specialization VARCHAR(100),
            qualification VARCHAR(255),
            experience_years INT,
            bio TEXT,
            profile_picture VARCHAR(255),
            enrollment_number VARCHAR(50) UNIQUE,
            department VARCHAR(100),
            semester INT,
            batch VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await ensureColumn('users', 'role', "ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student'");
    await ensureColumn('users', 'specialization', 'VARCHAR(100) NULL');
    await ensureColumn('users', 'qualification', 'VARCHAR(255) NULL');
    await ensureColumn('users', 'experience_years', 'INT NULL');
    await ensureColumn('users', 'bio', 'TEXT NULL');
    await ensureColumn('users', 'profile_picture', 'VARCHAR(255) NULL');
    await ensureColumn('users', 'enrollment_number', 'VARCHAR(50) UNIQUE NULL');
    await ensureColumn('users', 'department', 'VARCHAR(100) NULL');
    await ensureColumn('users', 'semester', 'INT NULL');
    await ensureColumn('users', 'batch', 'VARCHAR(50) NULL');
    await ensureColumn('users', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await ensureColumn('users', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await ensureColumn('users', 'email_verified', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn('users', 'email_verified_at', 'TIMESTAMP NULL');
    await ensureColumn('users', 'last_login_at', 'TIMESTAMP NULL');
    await ensureColumn('users', 'password_changed_at', 'TIMESTAMP NULL');
    await ensureColumn('users', 'failed_login_attempts', 'INT DEFAULT 0');
    await ensureColumn('users', 'locked_until', 'TIMESTAMP NULL');
    await ensureColumn('users', 'verification_sent_at', 'TIMESTAMP NULL');

    await db.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
            remember_me BOOLEAN DEFAULT FALSE,
            user_agent VARCHAR(500),
            ip_address VARCHAR(100),
            expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) DEFAULT 'auth',
            entity_id INT,
            ip_address VARCHAR(100),
            user_agent VARCHAR(500),
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS courses (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            teacher_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    await ensureColumn('courses', 'teacher_id', 'INT NULL');
    await ensureColumn('courses', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await ensureColumn('courses', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    await db.query(`
        CREATE TABLE IF NOT EXISTS enrollments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT,
            course_id INT,
            enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            UNIQUE KEY unique_enrollment (student_id, course_id)
        )
    `);

    await ensureColumn('enrollments', 'enrollment_date', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await ensureColumn('enrollments', 'status', "ENUM('active', 'completed', 'dropped') DEFAULT 'active'");

    await db.query(`
        CREATE TABLE IF NOT EXISTS assignments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            due_date TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
    `);

    await ensureColumn('assignments', 'description', 'TEXT NULL');
    await ensureColumn('assignments', 'due_date', 'TIMESTAMP NULL');
    await ensureColumn('assignments', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await ensureColumn('assignments', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    await db.query(`
        CREATE TABLE IF NOT EXISTS quizzes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_id INT NOT NULL,
            assignment_id INT,
            teacher_id INT NOT NULL,
            quiz_text TEXT NOT NULL,
            title VARCHAR(150),
            description TEXT,
            quiz_code VARCHAR(20) UNIQUE,
            status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
            scheduled_date TIMESTAMP NULL,
            duration_minutes INT DEFAULT 20,
            passing_score INT DEFAULT 60,
            settings_json JSON,
            source VARCHAR(50) DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await ensureColumn('quizzes', 'assignment_id', 'INT NULL');
    await ensureColumn('quizzes', 'quiz_text', 'TEXT NULL');
    await ensureColumn('quizzes', 'title', 'VARCHAR(150) NULL');
    await ensureColumn('quizzes', 'description', 'TEXT NULL');
    await ensureColumn('quizzes', 'quiz_code', 'VARCHAR(20) UNIQUE NULL');
    await ensureColumn('quizzes', 'status', "ENUM('draft', 'active', 'archived') DEFAULT 'draft'");
    await ensureColumn('quizzes', 'scheduled_date', 'TIMESTAMP NULL');
    await ensureColumn('quizzes', 'duration_minutes', 'INT DEFAULT 20');
    await ensureColumn('quizzes', 'passing_score', 'INT DEFAULT 60');
    await ensureColumn('quizzes', 'settings_json', 'JSON NULL');
    await ensureColumn('quizzes', 'source', "VARCHAR(50) DEFAULT 'manual'");
    await ensureColumn('quizzes', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    await db.query(`
        CREATE TABLE IF NOT EXISTS submissions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            assignment_no INT,
            student_id INT,
            submission_text TEXT,
            submission_file VARCHAR(255),
            grade DECIMAL(5,2),
            status ENUM('submitted', 'graded') DEFAULT 'submitted',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_no) REFERENCES assignments(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await ensureColumn('submissions', 'submission_text', 'TEXT NULL');
    await ensureColumn('submissions', 'submission_file', 'VARCHAR(255) NULL');
    await ensureColumn('submissions', 'grade', 'DECIMAL(5,2) NULL');
    await ensureColumn('submissions', 'status', "ENUM('submitted', 'graded') DEFAULT 'submitted'");
    await ensureColumn('submissions', 'submitted_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    await db.query(`
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            quiz_id INT NOT NULL,
            question_text TEXT NOT NULL,
            explanation TEXT,
            display_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS quiz_options (
            id INT PRIMARY KEY AUTO_INCREMENT,
            question_id INT NOT NULL,
            option_text TEXT NOT NULL,
            is_correct BOOLEAN DEFAULT FALSE,
            display_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            quiz_id INT NOT NULL,
            student_id INT NOT NULL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP NULL,
            score INT DEFAULT 0,
            total_questions INT DEFAULT 0,
            percentage DECIMAL(5,2) DEFAULT 0,
            status ENUM('in_progress', 'submitted') DEFAULT 'in_progress',
            violations TEXT,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
            id INT PRIMARY KEY AUTO_INCREMENT,
            attempt_id INT NOT NULL,
            question_id INT NOT NULL,
            selected_option_id INT,
            selected_answer TEXT,
            is_correct BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
            FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INT PRIMARY KEY AUTO_INCREMENT,
            owner_id INT NOT NULL,
            course_id INT,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255),
            storage_path VARCHAR(500),
            mime_type VARCHAR(100),
            size_bytes INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INT PRIMARY KEY AUTO_INCREMENT,
            organization_id INT NULL,
            recipient_id INT NOT NULL,
            actor_id INT NULL,
            course_id INT NULL,
            type VARCHAR(100) NOT NULL,
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            priority ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') DEFAULT 'NORMAL',
            reference_type VARCHAR(50),
            reference_id INT,
            metadata JSON,
            read_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_notifications_recipient_read_created (recipient_id, read_at, created_at),
            INDEX idx_notifications_recipient_created (recipient_id, created_at),
            INDEX idx_notifications_course_created (course_id, created_at),
            INDEX idx_notifications_reference (reference_type, reference_id),
            INDEX idx_notifications_type_created (type, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS announcements (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            teacher_id INT NOT NULL,
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_announcements_course_created (course_id, created_at)
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS activity_events (
            id INT PRIMARY KEY AUTO_INCREMENT,
            actor_id INT,
            target_user_id INT,
            course_id INT,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INT,
            action VARCHAR(100) NOT NULL,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
        )
    `);

    console.log('Commercial data schema verified');
}

module.exports = ensureCommercialSchema;