const db = require('./db');

async function ensureColumn(tableName, columnName, definition) {
    const [columns] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
    if (columns.length === 0) {
        await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

async function ensureIndex(tableName, indexName, definition) {
    const [indexes] = await db.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
    if (indexes.length === 0) {
        await db.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} ${definition}`);
    }
}

async function ensureCommercialSchema() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS institutes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(180) NOT NULL,
            code VARCHAR(80) UNIQUE,
            type ENUM('school', 'college', 'university', 'academy', 'training_center', 'other') DEFAULT 'other',
            email VARCHAR(150),
            phone VARCHAR(40),
            website VARCHAR(255),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            country VARCHAR(100),
            timezone VARCHAR(80),
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_institutes_status_name (status, name)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS departments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            institute_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(80),
            description TEXT,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
            UNIQUE KEY unique_department_code (institute_id, code),
            INDEX idx_departments_institute_status (institute_id, status)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS academic_years (
            id INT PRIMARY KEY AUTO_INCREMENT,
            institute_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            start_date DATE,
            end_date DATE,
            is_current BOOLEAN DEFAULT FALSE,
            status ENUM('active', 'archived') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
            UNIQUE KEY unique_academic_year_name (institute_id, name),
            INDEX idx_academic_years_current (institute_id, is_current, status)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS programs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            institute_id INT NOT NULL,
            department_id INT,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(80),
            level VARCHAR(80),
            duration_months INT,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
            UNIQUE KEY unique_program_code (institute_id, code),
            INDEX idx_programs_institute_department (institute_id, department_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS semesters (
            id INT PRIMARY KEY AUTO_INCREMENT,
            institute_id INT NOT NULL,
            academic_year_id INT,
            program_id INT,
            name VARCHAR(100) NOT NULL,
            sequence_no INT DEFAULT 1,
            start_date DATE,
            end_date DATE,
            status ENUM('active', 'archived') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
            FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
            FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
            INDEX idx_semesters_scope (institute_id, academic_year_id, program_id, status)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS batches (
            id INT PRIMARY KEY AUTO_INCREMENT,
            institute_id INT NOT NULL,
            program_id INT,
            academic_year_id INT,
            name VARCHAR(120) NOT NULL,
            code VARCHAR(80),
            start_year INT,
            end_year INT,
            status ENUM('active', 'completed', 'archived') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
            FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
            FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
            UNIQUE KEY unique_batch_code (institute_id, code),
            INDEX idx_batches_scope (institute_id, program_id, academic_year_id, status)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS subjects (
            id INT PRIMARY KEY AUTO_INCREMENT,
            institute_id INT NOT NULL,
            department_id INT,
            program_id INT,
            semester_id INT,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(80),
            description TEXT,
            credits DECIMAL(4,2),
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
            FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
            FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL,
            UNIQUE KEY unique_subject_code (institute_id, code),
            INDEX idx_subjects_scope (institute_id, department_id, program_id, semester_id, status)
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
            institute_id INT,
            department_id INT,
            program_id INT,
            semester_id INT,
            batch_id INT,
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
    await ensureColumn('users', 'institute_id', 'INT NULL');
    await ensureColumn('users', 'department_id', 'INT NULL');
    await ensureColumn('users', 'program_id', 'INT NULL');
    await ensureColumn('users', 'semester_id', 'INT NULL');
    await ensureColumn('users', 'batch_id', 'INT NULL');
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
    await ensureIndex('users', 'idx_users_institute_role', '(institute_id, role)');
    await ensureIndex('users', 'idx_users_academic_scope', '(institute_id, department_id, program_id, semester_id, batch_id)');

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
            institute_id INT,
            department_id INT,
            academic_year_id INT,
            program_id INT,
            semester_id INT,
            batch_id INT,
            subject_id INT,
            teacher_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE SET NULL,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
            FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
            FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
            FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL,
            FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    await ensureColumn('courses', 'institute_id', 'INT NULL');
    await ensureColumn('courses', 'department_id', 'INT NULL');
    await ensureColumn('courses', 'academic_year_id', 'INT NULL');
    await ensureColumn('courses', 'program_id', 'INT NULL');
    await ensureColumn('courses', 'semester_id', 'INT NULL');
    await ensureColumn('courses', 'batch_id', 'INT NULL');
    await ensureColumn('courses', 'subject_id', 'INT NULL');
    await ensureColumn('courses', 'teacher_id', 'INT NULL');
    await ensureColumn('courses', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await ensureColumn('courses', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await ensureIndex('courses', 'idx_courses_institute_teacher', '(institute_id, teacher_id)');
    await ensureIndex('courses', 'idx_courses_academic_scope', '(institute_id, department_id, program_id, semester_id, batch_id, subject_id)');

    await db.query(`
        UPDATE courses c
        JOIN users u ON u.id = c.teacher_id
        SET c.institute_id = u.institute_id
        WHERE c.institute_id IS NULL AND u.institute_id IS NOT NULL
    `);

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

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            title VARCHAR(150) NOT NULL,
            mode VARCHAR(50) DEFAULT 'assistant',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_ai_conversations_user_updated (user_id, updated_at),
            INDEX idx_ai_conversations_course (course_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_conversation_messages (
            id INT PRIMARY KEY AUTO_INCREMENT,
            conversation_id INT NOT NULL,
            role ENUM('user', 'assistant', 'system') NOT NULL,
            content LONGTEXT NOT NULL,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
            INDEX idx_ai_messages_conversation_created (conversation_id, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_documents (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            title VARCHAR(255) NOT NULL,
            original_name VARCHAR(255),
            mime_type VARCHAR(100),
            size_bytes INT DEFAULT 0,
            status ENUM('processing', 'processed', 'failed') DEFAULT 'processing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_ai_documents_user_created (user_id, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_document_chunks (
            id INT PRIMARY KEY AUTO_INCREMENT,
            document_id INT NOT NULL,
            chunk_index INT NOT NULL,
            content LONGTEXT NOT NULL,
            embedding_provider VARCHAR(50),
            embedding_status ENUM('pending', 'ready', 'failed') DEFAULT 'pending',
            vector_ref VARCHAR(255),
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES ai_documents(id) ON DELETE CASCADE,
            UNIQUE KEY unique_ai_document_chunk (document_id, chunk_index),
            INDEX idx_ai_chunks_vector_ref (vector_ref)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_artifacts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(150) NOT NULL,
            content LONGTEXT NOT NULL,
            source_type VARCHAR(50),
            source_id INT,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_ai_artifacts_user_type_created (user_id, type, created_at),
            INDEX idx_ai_artifacts_course_type (course_id, type)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_recommendations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            title VARCHAR(150) NOT NULL,
            recommendation LONGTEXT NOT NULL,
            priority ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') DEFAULT 'NORMAL',
            status ENUM('active', 'dismissed', 'completed') DEFAULT 'active',
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_ai_recommendations_user_status (user_id, status, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            feature VARCHAR(80) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            model VARCHAR(100),
            input_tokens INT DEFAULT 0,
            output_tokens INT DEFAULT 0,
            total_tokens INT DEFAULT 0,
            latency_ms INT DEFAULT 0,
            estimated_cost DECIMAL(10,6) DEFAULT 0,
            status ENUM('success', 'failure') DEFAULT 'success',
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_ai_usage_user_created (user_id, created_at),
            INDEX idx_ai_usage_feature_created (feature, created_at)
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            teacher_id INT NOT NULL,
            title VARCHAR(150) NOT NULL,
            session_date DATE NOT NULL,
            start_time TIME NULL,
            end_time TIME NULL,
            status ENUM('draft', 'open', 'closed') DEFAULT 'open',
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_attendance_sessions_course_date (course_id, session_date)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS attendance_records (
            id INT PRIMARY KEY AUTO_INCREMENT,
            session_id INT NOT NULL,
            student_id INT NOT NULL,
            status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'absent',
            remarks TEXT,
            marked_by INT,
            marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE KEY unique_attendance_record (session_id, student_id),
            INDEX idx_attendance_records_student (student_id, status)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS timetable_entries (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            teacher_id INT NOT NULL,
            subject VARCHAR(150) NOT NULL,
            classroom VARCHAR(100),
            day_of_week TINYINT NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            effective_from DATE NULL,
            effective_to DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_timetable_course_day (course_id, day_of_week, start_time)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NULL,
            created_by INT NOT NULL,
            type ENUM('quiz', 'assignment', 'attendance', 'announcement', 'holiday', 'event', 'study_plan', 'ai_reminder') NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            start_at DATETIME NOT NULL,
            end_at DATETIME NULL,
            visibility ENUM('course', 'private', 'global') DEFAULT 'course',
            reference_type VARCHAR(50),
            reference_id INT,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_calendar_course_start (course_id, start_at),
            INDEX idx_calendar_user_start (created_by, start_at)
        )
    `);

    await ensureColumn('assignments', 'status', "ENUM('draft', 'scheduled', 'published', 'closed') DEFAULT 'published'");
    await ensureColumn('assignments', 'published_at', 'TIMESTAMP NULL');
    await ensureColumn('assignments', 'scheduled_publish_at', 'TIMESTAMP NULL');
    await ensureColumn('assignments', 'allow_resubmission', 'BOOLEAN DEFAULT TRUE');

    await db.query(`
        CREATE TABLE IF NOT EXISTS assignment_files (
            id INT PRIMARY KEY AUTO_INCREMENT,
            assignment_id INT NOT NULL,
            uploaded_by INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_url VARCHAR(500),
            mime_type VARCHAR(100),
            size_bytes INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await ensureColumn('submissions', 'feedback', 'TEXT NULL');
    await ensureColumn('submissions', 'is_late', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn('submissions', 'attempt_no', 'INT DEFAULT 1');

    await db.query(`
        CREATE TABLE IF NOT EXISTS submission_files (
            id INT PRIMARY KEY AUTO_INCREMENT,
            submission_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_url VARCHAR(500),
            mime_type VARCHAR(100),
            size_bytes INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS rubrics (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            assignment_id INT NULL,
            teacher_id INT NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS rubric_criteria (
            id INT PRIMARY KEY AUTO_INCREMENT,
            rubric_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            max_score DECIMAL(6,2) NOT NULL DEFAULT 10,
            display_order INT DEFAULT 0,
            FOREIGN KEY (rubric_id) REFERENCES rubrics(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS gradebook_entries (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            student_id INT NOT NULL,
            source_type ENUM('assignment', 'quiz', 'attendance', 'internal', 'final') NOT NULL,
            source_id INT NULL,
            title VARCHAR(150) NOT NULL,
            score DECIMAL(8,2) NOT NULL DEFAULT 0,
            max_score DECIMAL(8,2) NOT NULL DEFAULT 100,
            weight DECIMAL(6,2) DEFAULT 1,
            feedback TEXT,
            graded_by INT,
            graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_gradebook_student_course (student_id, course_id),
            INDEX idx_gradebook_course_source (course_id, source_type, source_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS certificates (
            id INT PRIMARY KEY AUTO_INCREMENT,
            certificate_uid VARCHAR(80) UNIQUE NOT NULL,
            user_id INT NOT NULL,
            course_id INT NULL,
            issued_by INT NOT NULL,
            type ENUM('course_completion', 'participation', 'workshop', 'achievement') NOT NULL,
            title VARCHAR(180) NOT NULL,
            description TEXT,
            qr_verification_url VARCHAR(500),
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSON,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_certificates_user (user_id, issued_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS discussion_posts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            author_id INT NOT NULL,
            type ENUM('question', 'announcement') DEFAULT 'question',
            title VARCHAR(180) NOT NULL,
            content TEXT NOT NULL,
            is_pinned BOOLEAN DEFAULT FALSE,
            best_reply_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_discussion_course_created (course_id, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS discussion_replies (
            id INT PRIMARY KEY AUTO_INCREMENT,
            post_id INT NOT NULL,
            author_id INT NOT NULL,
            content TEXT NOT NULL,
            likes_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES discussion_posts(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS discussion_likes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            reply_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reply_id) REFERENCES discussion_replies(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_discussion_like (reply_id, user_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS course_progress (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_id INT NOT NULL,
            student_id INT NOT NULL,
            module_key VARCHAR(120) NOT NULL,
            lesson_key VARCHAR(120),
            status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
            progress_percent DECIMAL(5,2) DEFAULT 0,
            completed_at TIMESTAMP NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_course_progress (course_id, student_id, module_key, lesson_key)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS achievements (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            type VARCHAR(80) NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            xp INT DEFAULT 0,
            awarded_by INT NULL,
            awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSON,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_achievements_user (user_id, awarded_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS user_gamification (
            user_id INT PRIMARY KEY,
            xp INT DEFAULT 0,
            daily_streak INT DEFAULT 0,
            weekly_streak INT DEFAULT 0,
            last_activity_date DATE NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS personal_notes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            title VARCHAR(180) NOT NULL,
            content LONGTEXT NOT NULL,
            category VARCHAR(100),
            tags JSON,
            attachments JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_notes_user_updated (user_id, updated_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS bookmarks (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            target_type ENUM('course', 'assignment', 'quiz', 'ai_response', 'note', 'announcement') NOT NULL,
            target_id INT NOT NULL,
            title VARCHAR(180),
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_bookmark (user_id, target_type, target_id),
            INDEX idx_bookmarks_user_type (user_id, target_type)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS reports (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NULL,
            type VARCHAR(80) NOT NULL,
            title VARCHAR(180) NOT NULL,
            format ENUM('json', 'csv', 'pdf', 'excel') DEFAULT 'json',
            payload JSON,
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
            INDEX idx_reports_user_type (user_id, type, generated_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS download_events (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            target_type ENUM('assignment', 'pdf', 'note', 'certificate') NOT NULL,
            target_id INT NOT NULL,
            action ENUM('viewed', 'downloaded', 'completed') NOT NULL,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_downloads_user_target (user_id, target_type, target_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS student_performance (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            overall_score DECIMAL(5,2) DEFAULT 0,
            quiz_accuracy DECIMAL(5,2) DEFAULT 0,
            assignment_quality DECIMAL(5,2) DEFAULT 0,
            attendance_contribution DECIMAL(5,2) DEFAULT 0,
            learning_consistency DECIMAL(5,2) DEFAULT 0,
            performance_summary TEXT,
            strengths JSON,
            weaknesses JSON,
            last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            UNIQUE KEY unique_student_performance_scope (student_id, course_id),
            INDEX idx_student_performance_score (course_id, overall_score)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS performance_history (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            period_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
            period_start DATE NOT NULL,
            overall_score DECIMAL(5,2) DEFAULT 0,
            quiz_accuracy DECIMAL(5,2) DEFAULT 0,
            assignment_quality DECIMAL(5,2) DEFAULT 0,
            attendance_contribution DECIMAL(5,2) DEFAULT 0,
            learning_consistency DECIMAL(5,2) DEFAULT 0,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            UNIQUE KEY unique_performance_history_period (student_id, course_id, period_type, period_start),
            INDEX idx_performance_history_student_period (student_id, period_type, period_start)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS learning_streaks (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            daily_streak INT DEFAULT 0,
            weekly_streak INT DEFAULT 0,
            longest_streak INT DEFAULT 0,
            missed_days INT DEFAULT 0,
            last_activity_date DATE NULL,
            active_days JSON,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_learning_streak_student (student_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS study_plans (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            title VARCHAR(180) NOT NULL,
            plan_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
            exam_date DATE NULL,
            recommended_hours DECIMAL(6,2) DEFAULT 0,
            plan_json JSON NOT NULL,
            status ENUM('active', 'completed', 'archived') DEFAULT 'active',
            generated_by ENUM('system', 'ai') DEFAULT 'system',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            INDEX idx_study_plans_student_status (student_id, status, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS weak_topics (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            topic VARCHAR(255) NOT NULL,
            source_type ENUM('quiz', 'assignment', 'ai', 'lms', 'combined') DEFAULT 'combined',
            source_id INT NULL,
            weakness_score DECIMAL(5,2) DEFAULT 0,
            evidence_count INT DEFAULT 0,
            last_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('active', 'improving', 'resolved') DEFAULT 'active',
            metadata JSON,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            UNIQUE KEY unique_weak_topic_scope (student_id, course_id, topic, source_type),
            INDEX idx_weak_topics_student_status (student_id, status, weakness_score)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS recommendations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            type ENUM('practice_topic', 'watch_revision', 'attempt_quiz', 'complete_assignment', 'review_notes', 'study_plan', 'teacher_alert') NOT NULL,
            title VARCHAR(180) NOT NULL,
            description TEXT NOT NULL,
            priority ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') DEFAULT 'NORMAL',
            status ENUM('active', 'completed', 'dismissed') DEFAULT 'active',
            reference_type VARCHAR(50),
            reference_id INT,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            INDEX idx_recommendations_student_status (student_id, status, priority, created_at),
            INDEX idx_recommendations_course_type (course_id, type, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS prediction_history (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            probability_of_passing DECIMAL(5,2) DEFAULT 0,
            estimated_marks DECIMAL(5,2) DEFAULT 0,
            confidence_score DECIMAL(5,2) DEFAULT 0,
            risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
            recommended_study_hours DECIMAL(6,2) DEFAULT 0,
            model_version VARCHAR(50) DEFAULT 'deterministic-v1',
            factors JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            INDEX idx_prediction_student_created (student_id, created_at),
            INDEX idx_prediction_course_risk (course_id, risk_level, created_at)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS performance_snapshots (
            id INT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            course_id INT NULL,
            snapshot_type ENUM('automatic', 'manual', 'event') DEFAULT 'automatic',
            payload JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            INDEX idx_snapshots_student_created (student_id, created_at),
            INDEX idx_snapshots_course_created (course_id, created_at)
        )
    `);
    await ensureIndex('quiz_attempts', 'idx_quiz_attempts_student_status_submitted', '(student_id, status, submitted_at)');
    await ensureIndex('quiz_attempts', 'idx_quiz_attempts_quiz_status_submitted', '(quiz_id, status, submitted_at)');
    await ensureIndex('submissions', 'idx_submissions_student_submitted', '(student_id, submitted_at)');
    await ensureIndex('submissions', 'idx_submissions_assignment_status', '(assignment_no, status)');
    await ensureIndex('activity_events', 'idx_activity_course_created', '(course_id, created_at)');
    await ensureIndex('activity_events', 'idx_activity_actor_target_created', '(actor_id, target_user_id, created_at)');
    await ensureIndex('enrollments', 'idx_enrollments_course_status', '(course_id, status)');
    await ensureIndex('ai_usage_logs', 'idx_ai_usage_user_feature_created', '(user_id, feature, created_at)');
    console.log('Commercial data schema verified');
}

module.exports = ensureCommercialSchema;

