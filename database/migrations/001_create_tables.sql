-- Student Profile System Database Schema
-- Migration 001: Create initial tables

-- Users table (teachers, students, admins)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('teacher', 'student', 'admin') NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    teacher_id INT NOT NULL,
    class_code VARCHAR(20) UNIQUE NOT NULL,
    academic_year VARCHAR(20),
    semester VARCHAR(20),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_teacher (teacher_id),
    INDEX idx_class_code (class_code)
);

-- Class enrollments (many-to-many relationship between students and classes)
CREATE TABLE IF NOT EXISTS class_enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_enrollment (student_id, class_id),
    INDEX idx_student (student_id),
    INDEX idx_class (class_id)
);

-- Student profiles
CREATE TABLE IF NOT EXISTS student_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    student_id VARCHAR(50),
    year_level VARCHAR(20),
    major VARCHAR(100),
    profile_photo_url VARCHAR(500),
    bio TEXT,
    contact_preferences JSON,
    short_term_goals TEXT,
    long_term_goals TEXT,
    academic_goals TEXT,
    personal_goals TEXT,
    skills JSON,
    interests JSON,
    activities JSON,
    profile_completed BOOLEAN DEFAULT FALSE,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_student_id (student_id)
);

-- Uploaded files (resumes, documents)
CREATE TABLE IF NOT EXISTS uploaded_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INT NOT NULL,
    file_data LONGBLOB NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT FALSE,
    parsed_data JSON,
    parsing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_file_hash (file_hash),
    INDEX idx_file_type (file_type)
);

-- Surveys
CREATE TABLE IF NOT EXISTS surveys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    teacher_id INT NOT NULL,
    survey_data JSON NOT NULL,
    template_name VARCHAR(100),
    is_template BOOLEAN DEFAULT FALSE,
    open_date TIMESTAMP NULL,
    close_date TIMESTAMP NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_teacher (teacher_id),
    INDEX idx_template (template_name),
    INDEX idx_active (active)
);

-- Survey assignments (which classes get which surveys)
CREATE TABLE IF NOT EXISTS survey_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    class_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_assignment (survey_id, class_id),
    INDEX idx_survey (survey_id),
    INDEX idx_class (class_id)
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    student_id INT NOT NULL,
    response_data JSON NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_response (survey_id, student_id),
    INDEX idx_survey (survey_id),
    INDEX idx_student (student_id),
    INDEX idx_completed (is_complete)
);

-- Sessions table for express-session
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);

-- Insert default admin user (password: admin123 - change in production)
-- Hash generated with bcrypt for password 'admin123'
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified) 
VALUES ('admin@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', TRUE)
ON DUPLICATE KEY UPDATE email = email; 