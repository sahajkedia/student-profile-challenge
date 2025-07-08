const mysql = require("mysql2");
require("dotenv").config();

// Database connection configuration
const dbConfig = {
	host: process.env.DB_HOST || "localhost",
	port: process.env.DB_PORT || 3306,
	user: process.env.DB_USER || "app_user",
	password: process.env.DB_PASSWORD || "app_password",
	database: process.env.DB_NAME || "student_profile_system",
	charset: "utf8mb4",
	connectionLimit: 10,
	multipleStatements: true,
};

// Create connection pool for better performance
const pool = mysql.createPool(dbConfig);

// Create promise-based pool for async/await usage
const promisePool = pool.promise();

// Test database connection
const testConnection = async () => {
	try {
		const connection = await promisePool.getConnection();
		console.log("Database connected successfully");
		connection.release();
		return true;
	} catch (error) {
		console.error("Database connection failed:", error.message);
		return false;
	}
};

// Execute query with error handling
const executeQuery = async (query, params = []) => {
	try {
		const [results] = await promisePool.execute(query, params);
		return results;
	} catch (error) {
		console.error("Database query error:", error.message);
		throw error;
	}
};

module.exports = {
	pool: promisePool,
	testConnection,
	executeQuery,
};
