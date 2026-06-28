# Study Hero Backend Documentation

## Overview
Study Hero is an educational platform that connects teachers and students. This documentation covers the backend implementation including database structure, API endpoints, and authentication system.





CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```



CREATE TABLE courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    teacher_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);
```


```sql
CREATE TABLE enrollments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    course_id INT,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE KEY unique_enrollment (student_id, course_id)
);
```


CREATE TABLE Quiz_Assigned (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

CREATE TABLE Quiz_Submitted (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quiz_id INT,
    student_id INT,
    submission_text TEXT,
    submission_file VARCHAR(255),
    grade DECIMAL(5,2),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES Quiz_Assigned(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE KEY unique_submission (quiz_id, student_id)
);
```


For optimal performance, the following indexes have been created:
```sql
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_quiz_assigned_course ON Quiz_Assigned(course_id);
CREATE INDEX idx_quiz_submitted_quiz ON Quiz_Submitted(quiz_id);
CREATE INDEX idx_quiz_submitted_student ON Quiz_Submitted(student_id);
```

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
  - Required fields: username, email, password, role
- `POST /api/users/login` - User login
  - Returns JWT token and user data

### User Management
- `GET /api/users/profile` - Get user profile (requires authentication)
- `PUT /api/users/profile` - Update user profile (requires authentication)
- `GET /api/users/teachers` - Get list of all teachers
- `GET /api/users/students` - Get list of all students

### Course Management
- `POST /api/courses` - Create new course (teacher only)
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course (teacher only)
- `DELETE /api/courses/:id` - Delete course (teacher only)

### Enrollment
- `POST /api/courses/:id/enroll` - Enroll in a course (student only)
- `GET /api/courses/:id/enrollments` - Get course enrollments (teacher only)

### Quiz Management
- `POST /api/courses/:id/quizzes` - Create quiz (teacher only)
- `GET /api/courses/:id/quizzes` - Get course quizzes
- `GET /api/quizzes/:id` - Get quiz details
- `PUT /api/quizzes/:id` - Update quiz (teacher only)
- `DELETE /api/quizzes/:id` - Delete quiz (teacher only)

### Quiz Submission
- `POST /api/quizzes/:id/submit` - Submit quiz (student only)
- `GET /api/quizzes/:id/submissions` - Get quiz submissions (teacher only)
- `PUT /api/submissions/:id/grade` - Grade submission (teacher only)

## Authentication

### JWT Implementation
- Tokens are generated upon successful login
- Token contains user ID and role
- Token expiration: 24 hours
- Required for protected routes

### Protected Routes
All routes except login and register require authentication. Add the following header:
```
Authorization: Bearer <token>
```

## Error Handling
All API endpoints return appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Environment Variables
Create a `.env` file with the following variables:
```
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=study_hero
JWT_SECRET=your_jwt_secret
PORT=4000
```

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create database:
```bash
mysql -u root -p < database.sql
```

3. Start the server:
```bash
npm start
```

## Testing the API

### Register a Teacher
```bash
curl -X POST http://localhost:4000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teacher1",
    "email": "teacher1@example.com",
    "password": "password123",
    "role": "teacher"
  }'
```

### Register a Student
```bash
curl -X POST http://localhost:4000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student1",
    "email": "student1@example.com",
    "password": "password123",
    "role": "student"
  }'
```

### Login
```bash
curl -X POST http://localhost:4000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher1@example.com",
    "password": "password123"
  }'
```

## Notes for Frontend Development

1. **Authentication Flow**
   - Store JWT token in localStorage or secure cookie
   - Include token in Authorization header for all requests
   - Handle token expiration and refresh

2. **Role-Based Access**
   - Use user.role to determine UI elements and permissions
   - Hide teacher-specific features from students
   - Hide student-specific features from teachers

3. **Data Structure**
   - User object contains basic profile information
   - Course object includes teacher details
   - Quiz object includes course and submission details

4. **Error Handling**
   - Implement proper error messages for API responses
   - Handle network errors and timeouts
   - Show appropriate loading states

## Future Enhancements
The following features can be implemented by other team members:
- File upload system for quiz submissions
- Notifications for quiz deadlines
- Chat/messaging system
- Analytics and reporting
- Email verification
- Password reset functionality
## Render Deployment

Set the backend root directory to `study_hero_backend`.

Build command:
```bash
npm install
```

Start command:
```bash
npm start
```

Required Render environment variables are documented in `.env.example`:
- `NODE_ENV=production`
- `PORT`
- `FRONTEND_URL`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `MISTRAL_API_KEY`

Use a cloud-hosted MySQL database and run `database.sql` before using the API. Do not deploy real `.env` files or hardcoded credentials.

