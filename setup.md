# Setup Instructions

## 1. Environment Configuration

Create a `.env` file in the root directory with the following content:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# Session Configuration
SESSION_SECRET=your-secret-key-change-in-production

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_profile_system
DB_USER=root
DB_PASSWORD=

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,doc
```

## 2. Database Setup

### Install MariaDB/MySQL

**macOS (using Homebrew):**

```bash
brew install mariadb
brew services start mariadb
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install mariadb-server
sudo systemctl start mariadb
```

**Windows:**
Download and install from https://mariadb.org/download/

### Create Database

1. Login to MariaDB:

```bash
mysql -u root -p
```

2. Create database:

```sql
CREATE DATABASE student_profile_system;
USE student_profile_system;
```

3. Run the migration:

```bash
mysql -u root -p student_profile_system < database/migrations/001_create_tables.sql
```

## 3. Start the Application

### Terminal 1 - Backend:

```bash
npm run dev
```

### Terminal 2 - Frontend:

```bash
cd frontend
npm start
```

## 4. Test the Application

1. Open browser to `http://localhost:3001`
2. Try registering a new user
3. Login with the created user
4. Access the dashboard and profile pages

## 5. Default Admin User

The migration creates a default admin user:

- Email: `admin@example.com`
- Password: `admin123`

**Important:** Change this password in production!

## 6. Troubleshooting

### Common Issues:

1. **Database Connection Error:**

   - Check if MariaDB is running
   - Verify database credentials in `.env`
   - Ensure database exists

2. **404 Authentication Errors:**

   - Ensure backend server is running on port 3000
   - Check that authentication routes are properly imported

3. **CORS Issues:**
   - Verify FRONTEND_URL in `.env` matches your React app URL
   - Check that credentials are enabled in CORS config
