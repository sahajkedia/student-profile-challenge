const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
	cors({
		origin: process.env.FRONTEND_URL || "http://localhost:3001",
		credentials: true,
	})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
	session({
		secret:
			process.env.SESSION_SECRET || "your-secret-key-change-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: process.env.NODE_ENV === "production",
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
		},
	})
);

// Serve static files from React app in production
if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "frontend/build")));
}

// Import routes
const authRoutes = require("./backend/routes/auth");
const profileRoutes = require("./backend/routes/profiles");
const fileRoutes = require("./backend/routes/files");
const surveyRoutes = require("./backend/routes/surveys");
const classRoutes = require("./backend/routes/classes");

// Routes
app.get("/api/health", (req, res) => {
	res.json({
		message: "Server is running",
		timestamp: new Date().toISOString(),
	});
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Profile routes
app.use("/api/profiles", profileRoutes);

// File routes
app.use("/api/files", fileRoutes);

// Survey routes
app.use("/api/surveys", surveyRoutes);

// Class routes
app.use("/api/classes", classRoutes);

// Catch-all handler for React Router (in production)
if (process.env.NODE_ENV === "production") {
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "frontend/build/index.html"));
	});
}

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ message: "Something went wrong!" });
});

// Import database for connection testing
const { testConnection } = require("./backend/config/database");

app.listen(PORT, async () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

	// Test database connection on startup
	console.log("Testing database connection...");
	const dbConnected = await testConnection();
	if (dbConnected) {
		console.log("✅ Database connection successful");
	} else {
		console.log("❌ Database connection failed");
	}
});
