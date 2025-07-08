const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { executeQuery } = require("../config/database");
const router = express.Router();

// Register new user
router.post("/register", async (req, res) => {
	try {
		const { first_name, last_name, email, password, role } = req.body;

		// Validate required fields
		if (!first_name || !last_name || !email || !password || !role) {
			return res.status(400).json({ message: "All fields are required" });
		}

		// Validate role
		if (!["teacher", "student", "admin"].includes(role)) {
			return res.status(400).json({ message: "Invalid role specified" });
		}

		// Check if user already exists
		const existingUser = await executeQuery(
			"SELECT id FROM users WHERE email = ?",
			[email]
		);

		if (existingUser.length > 0) {
			return res
				.status(400)
				.json({ message: "User with this email already exists" });
		}

		// Hash password
		const saltRounds = 10;
		const password_hash = await bcrypt.hash(password, saltRounds);

		// Create user
		const result = await executeQuery(
			"INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?, TRUE)",
			[first_name, last_name, email, password_hash, role]
		);

		// Get created user (without password)
		const newUser = await executeQuery(
			"SELECT id, first_name, last_name, email, role, email_verified, created_at FROM users WHERE id = ?",
			[result.insertId]
		);

		// Create session
		req.session.userId = newUser[0].id;
		req.session.user = newUser[0];

		res.status(201).json({
			message: "User registered successfully",
			user: newUser[0],
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ message: "Registration failed" });
	}
});

// Login user
router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		// Validate required fields
		if (!email || !password) {
			return res
				.status(400)
				.json({ message: "Email and password are required" });
		}

		// Find user
		const users = await executeQuery(
			"SELECT id, first_name, last_name, email, password_hash, role, email_verified FROM users WHERE email = ?",
			[email]
		);

		if (users.length === 0) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		const user = users[0];

		// Check password
		const isValidPassword = await bcrypt.compare(password, user.password_hash);
		if (!isValidPassword) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		// Remove password from user object
		delete user.password_hash;

		// Create session
		req.session.userId = user.id;
		req.session.user = user;

		res.json({
			message: "Login successful",
			user: user,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ message: "Login failed" });
	}
});

// Logout user
router.post("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Logout error:", err);
			return res.status(500).json({ message: "Logout failed" });
		}
		res.clearCookie("connect.sid");
		res.json({ message: "Logout successful" });
	});
});

// Get current user (check authentication status)
router.get("/me", (req, res) => {
	if (req.session.userId && req.session.user) {
		res.json({
			authenticated: true,
			user: req.session.user,
		});
	} else {
		res.status(401).json({
			authenticated: false,
			message: "Not authenticated",
		});
	}
});

// Update user profile
router.put("/profile", async (req, res) => {
	try {
		if (!req.session.userId) {
			return res.status(401).json({ message: "Not authenticated" });
		}

		const { first_name, last_name } = req.body;
		const userId = req.session.userId;

		// Update basic user info
		await executeQuery(
			"UPDATE users SET first_name = ?, last_name = ?, updated_at = NOW() WHERE id = ?",
			[first_name, last_name, userId]
		);

		// Get updated user
		const updatedUser = await executeQuery(
			"SELECT id, first_name, last_name, email, role, email_verified, created_at FROM users WHERE id = ?",
			[userId]
		);

		// Update session
		req.session.user = updatedUser[0];

		res.json({
			message: "Profile updated successfully",
			user: updatedUser[0],
		});
	} catch (error) {
		console.error("Profile update error:", error);
		res.status(500).json({ message: "Profile update failed" });
	}
});

// Request password reset
router.post("/forgot-password", async (req, res) => {
	try {
		const { email } = req.body;

		if (!email) {
			return res.status(400).json({ message: "Email is required" });
		}

		// Check if user exists
		const users = await executeQuery(
			"SELECT id, first_name, last_name, email FROM users WHERE email = ?",
			[email]
		);

		if (users.length === 0) {
			// Don't reveal if email exists or not for security
			return res.json({
				message: "If the email exists, a reset link has been sent",
			});
		}

		const user = users[0];

		// Generate reset token
		const resetToken = crypto.randomBytes(32).toString("hex");
		const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

		// Store reset token in database
		await executeQuery(
			"UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
			[resetToken, resetTokenExpiry, user.id]
		);

		// In a real app, you would send an email here
		// For now, we'll just return the token for testing
		console.log(`Password reset token for ${email}: ${resetToken}`);

		res.json({
			message: "If the email exists, a reset link has been sent",
			// Remove this in production - only for testing
			resetToken: resetToken,
		});
	} catch (error) {
		console.error("Password reset request error:", error);
		res.status(500).json({ message: "Password reset request failed" });
	}
});

// Reset password with token
router.post("/reset-password", async (req, res) => {
	try {
		const { token, newPassword } = req.body;

		if (!token || !newPassword) {
			return res
				.status(400)
				.json({ message: "Token and new password are required" });
		}

		if (newPassword.length < 6) {
			return res
				.status(400)
				.json({ message: "Password must be at least 6 characters long" });
		}

		// Find user with valid reset token
		const users = await executeQuery(
			"SELECT id, first_name, last_name, email, role FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
			[token]
		);

		if (users.length === 0) {
			return res
				.status(400)
				.json({ message: "Invalid or expired reset token" });
		}

		const user = users[0];

		// Hash new password
		const saltRounds = 10;
		const password_hash = await bcrypt.hash(newPassword, saltRounds);

		// Update password and clear reset token
		await executeQuery(
			"UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
			[password_hash, user.id]
		);

		res.json({ message: "Password reset successful" });
	} catch (error) {
		console.error("Password reset error:", error);
		res.status(500).json({ message: "Password reset failed" });
	}
});

// Change password (for authenticated users)
router.post("/change-password", async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body;

		if (!req.session.userId || !req.session.user) {
			return res.status(401).json({ message: "Authentication required" });
		}

		if (!currentPassword || !newPassword) {
			return res
				.status(400)
				.json({ message: "Current password and new password are required" });
		}

		if (newPassword.length < 6) {
			return res
				.status(400)
				.json({ message: "New password must be at least 6 characters long" });
		}

		// Get user's current password hash
		const users = await executeQuery(
			"SELECT password_hash FROM users WHERE id = ?",
			[req.session.userId]
		);

		if (users.length === 0) {
			return res.status(404).json({ message: "User not found" });
		}

		// Verify current password
		const isValidPassword = await bcrypt.compare(
			currentPassword,
			users[0].password_hash
		);
		if (!isValidPassword) {
			return res.status(400).json({ message: "Current password is incorrect" });
		}

		// Hash new password
		const saltRounds = 10;
		const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

		// Update password
		await executeQuery("UPDATE users SET password_hash = ? WHERE id = ?", [
			newPasswordHash,
			req.session.userId,
		]);

		res.json({ message: "Password changed successfully" });
	} catch (error) {
		console.error("Change password error:", error);
		res.status(500).json({ message: "Password change failed" });
	}
});

module.exports = router;
