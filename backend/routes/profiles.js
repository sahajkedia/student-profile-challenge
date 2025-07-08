const express = require("express");
const { executeQuery } = require("../config/database");
const { requireAuth, requireRole } = require("../middleware/auth");
const router = express.Router();

// Get student profile by user ID
router.get("/:userId", requireAuth, async (req, res) => {
	try {
		const { userId } = req.params;

		// Check if user can access this profile
		const canAccess =
			req.session.user.id === parseInt(userId) ||
			req.session.user.role === "teacher" ||
			req.session.user.role === "admin";

		if (!canAccess) {
			return res.status(403).json({ message: "Access denied" });
		}

		const profiles = await executeQuery(
			`SELECT 
                sp.id,
                sp.user_id,
                sp.goals,
                sp.interests,
                sp.skills,
                sp.bio,
                sp.academic_level,
                sp.created_at,
                sp.updated_at,
                u.first_name,
                u.last_name,
                u.email,
                u.role
            FROM student_profiles sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.user_id = ?`,
			[userId]
		);

		if (profiles.length === 0) {
			return res.status(404).json({ message: "Profile not found" });
		}

		res.json(profiles[0]);
	} catch (error) {
		console.error("Get profile error:", error);
		res.status(500).json({ message: "Failed to get profile" });
	}
});

// Create or update student profile
router.post("/", requireAuth, async (req, res) => {
	try {
		const { goals, interests, skills, bio, academic_level } = req.body;
		const userId = req.session.user.id;

		// Only students can create/update their own profiles
		if (req.session.user.role !== "student") {
			return res
				.status(403)
				.json({ message: "Only students can create profiles" });
		}

		// Check if profile already exists
		const existingProfile = await executeQuery(
			"SELECT id FROM student_profiles WHERE user_id = ?",
			[userId]
		);

		if (existingProfile.length > 0) {
			// Update existing profile
			await executeQuery(
				`UPDATE student_profiles 
                SET goals = ?, interests = ?, skills = ?, bio = ?, academic_level = ?, updated_at = NOW()
                WHERE user_id = ?`,
				[goals, interests, skills, bio, academic_level, userId]
			);
		} else {
			// Create new profile
			await executeQuery(
				`INSERT INTO student_profiles (user_id, goals, interests, skills, bio, academic_level)
                VALUES (?, ?, ?, ?, ?, ?)`,
				[userId, goals, interests, skills, bio, academic_level]
			);
		}

		// Get the updated/created profile
		const profile = await executeQuery(
			`SELECT 
                sp.id,
                sp.user_id,
                sp.goals,
                sp.interests,
                sp.skills,
                sp.bio,
                sp.academic_level,
                sp.created_at,
                sp.updated_at,
                u.first_name,
                u.last_name,
                u.email,
                u.role
            FROM student_profiles sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.user_id = ?`,
			[userId]
		);

		res.json({
			message: "Profile saved successfully",
			profile: profile[0],
		});
	} catch (error) {
		console.error("Save profile error:", error);
		res.status(500).json({ message: "Failed to save profile" });
	}
});

// Get all student profiles (for teachers and admins)
router.get(
	"/",
	requireAuth,
	requireRole(["teacher", "admin"]),
	async (req, res) => {
		try {
			const profiles = await executeQuery(
				`SELECT 
                sp.id,
                sp.user_id,
                sp.goals,
                sp.interests,
                sp.skills,
                sp.bio,
                sp.academic_level,
                sp.created_at,
                sp.updated_at,
                u.first_name,
                u.last_name,
                u.email,
                u.role
            FROM student_profiles sp
            JOIN users u ON sp.user_id = u.id
            ORDER BY u.last_name, u.first_name`
			);

			res.json(profiles);
		} catch (error) {
			console.error("Get all profiles error:", error);
			res.status(500).json({ message: "Failed to get profiles" });
		}
	}
);

// Delete student profile
router.delete("/:userId", requireAuth, async (req, res) => {
	try {
		const { userId } = req.params;

		// Check if user can delete this profile
		const canDelete =
			req.session.user.id === parseInt(userId) ||
			req.session.user.role === "admin";

		if (!canDelete) {
			return res.status(403).json({ message: "Access denied" });
		}

		const result = await executeQuery(
			"DELETE FROM student_profiles WHERE user_id = ?",
			[userId]
		);

		if (result.affectedRows === 0) {
			return res.status(404).json({ message: "Profile not found" });
		}

		res.json({ message: "Profile deleted successfully" });
	} catch (error) {
		console.error("Delete profile error:", error);
		res.status(500).json({ message: "Failed to delete profile" });
	}
});

module.exports = router;
