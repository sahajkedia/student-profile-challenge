const express = require("express");
const { executeQuery } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// Get all classes (Teachers/Admins can see all, Students see their enrolled classes)
router.get("/", requireAuth, async (req, res) => {
	try {
		const userId = req.session.user.id;
		const userRole = req.session.user.role;

		let query, params;

		if (userRole === "student") {
			// Students see only their enrolled classes
			query = `
                SELECT c.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                       COUNT(DISTINCT ce.student_id) as student_count,
                       ce.enrolled_at
                FROM classes c
                JOIN users u ON c.teacher_id = u.id
                JOIN class_enrollments ce ON c.id = ce.class_id
                WHERE ce.student_id = ?
                GROUP BY c.id
                ORDER BY c.name
            `;
			params = [userId];
		} else if (userRole === "teacher") {
			// Teachers see their own classes
			query = `
                SELECT c.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                       COUNT(DISTINCT ce.student_id) as student_count
                FROM classes c
                JOIN users u ON c.teacher_id = u.id
                LEFT JOIN class_enrollments ce ON c.id = ce.class_id
                WHERE c.teacher_id = ?
                GROUP BY c.id
                ORDER BY c.name
            `;
			params = [userId];
		} else {
			// Admins see all classes
			query = `
                SELECT c.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                       COUNT(DISTINCT ce.student_id) as student_count
                FROM classes c
                JOIN users u ON c.teacher_id = u.id
                LEFT JOIN class_enrollments ce ON c.id = ce.class_id
                GROUP BY c.id
                ORDER BY c.name
            `;
			params = [];
		}

		const classes = await executeQuery(query, params);
		res.json(classes);
	} catch (error) {
		console.error("Get classes error:", error);
		res.status(500).json({ message: "Failed to get classes" });
	}
});

// Create a new class (Teachers/Admins only)
router.post("/", requireAuth, async (req, res) => {
	try {
		const { name, description, section, semester, year } = req.body;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can create classes" });
		}

		if (!name) {
			return res.status(400).json({ message: "Class name is required" });
		}

		const result = await executeQuery(
			"INSERT INTO classes (name, description, section, semester, year, teacher_id) VALUES (?, ?, ?, ?, ?, ?)",
			[
				name,
				description || null,
				section || null,
				semester || null,
				year || null,
				req.session.user.id,
			]
		);

		res.status(201).json({
			message: "Class created successfully",
			classId: result.insertId,
			class: {
				id: result.insertId,
				name,
				description,
				section,
				semester,
				year,
				teacher_id: req.session.user.id,
			},
		});
	} catch (error) {
		console.error("Create class error:", error);
		res.status(500).json({ message: "Failed to create class" });
	}
});

// Get class details with enrolled students
router.get("/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.session.user.id;
		const userRole = req.session.user.role;

		// Get class info
		const classes = await executeQuery(
			`SELECT c.*, CONCAT(u.first_name, ' ', u.last_name) as teacher_name
             FROM classes c
             JOIN users u ON c.teacher_id = u.id
             WHERE c.id = ?`,
			[id]
		);

		if (classes.length === 0) {
			return res.status(404).json({ message: "Class not found" });
		}

		const classInfo = classes[0];

		// Check access permissions
		if (userRole === "student") {
			// Check if student is enrolled in this class
			const enrollment = await executeQuery(
				"SELECT 1 FROM class_enrollments WHERE class_id = ? AND student_id = ?",
				[id, userId]
			);

			if (enrollment.length === 0) {
				return res
					.status(403)
					.json({ message: "You are not enrolled in this class" });
			}
		} else if (userRole === "teacher" && classInfo.teacher_id !== userId) {
			return res
				.status(403)
				.json({ message: "You can only access your own classes" });
		}

		// Get enrolled students
		const students = await executeQuery(
			`SELECT u.id, u.first_name, u.last_name, u.email, ce.enrolled_at,
                    sp.student_id, sp.year_level, sp.major
             FROM class_enrollments ce
             JOIN users u ON ce.student_id = u.id
             LEFT JOIN student_profiles sp ON u.id = sp.user_id
             WHERE ce.class_id = ?
             ORDER BY u.last_name, u.first_name`,
			[id]
		);

		res.json({
			...classInfo,
			students,
			student_count: students.length,
		});
	} catch (error) {
		console.error("Get class error:", error);
		res.status(500).json({ message: "Failed to get class details" });
	}
});

// Enroll student in class (Teachers/Admins only)
router.post("/:id/enroll", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const { student_id } = req.body;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can enroll students" });
		}

		if (!student_id) {
			return res.status(400).json({ message: "Student ID is required" });
		}

		// Check if class exists and user has permission
		const classes = await executeQuery("SELECT * FROM classes WHERE id = ?", [
			id,
		]);
		if (classes.length === 0) {
			return res.status(404).json({ message: "Class not found" });
		}

		const classInfo = classes[0];
		if (
			req.session.user.role === "teacher" &&
			classInfo.teacher_id !== req.session.user.id
		) {
			return res
				.status(403)
				.json({ message: "You can only enroll students in your own classes" });
		}

		// Check if student exists
		const students = await executeQuery(
			"SELECT * FROM users WHERE id = ? AND role = ?",
			[student_id, "student"]
		);

		if (students.length === 0) {
			return res.status(404).json({ message: "Student not found" });
		}

		// Check if already enrolled
		const existingEnrollment = await executeQuery(
			"SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?",
			[id, student_id]
		);

		if (existingEnrollment.length > 0) {
			return res
				.status(400)
				.json({ message: "Student is already enrolled in this class" });
		}

		// Enroll student
		await executeQuery(
			"INSERT INTO class_enrollments (class_id, student_id) VALUES (?, ?)",
			[id, student_id]
		);

		res.json({ message: "Student enrolled successfully" });
	} catch (error) {
		console.error("Enroll student error:", error);
		res.status(500).json({ message: "Failed to enroll student" });
	}
});

// Remove student from class (Teachers/Admins only)
router.delete("/:id/students/:studentId", requireAuth, async (req, res) => {
	try {
		const { id, studentId } = req.params;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can remove students" });
		}

		// Check if class exists and user has permission
		const classes = await executeQuery("SELECT * FROM classes WHERE id = ?", [
			id,
		]);
		if (classes.length === 0) {
			return res.status(404).json({ message: "Class not found" });
		}

		const classInfo = classes[0];
		if (
			req.session.user.role === "teacher" &&
			classInfo.teacher_id !== req.session.user.id
		) {
			return res
				.status(403)
				.json({
					message: "You can only remove students from your own classes",
				});
		}

		// Remove enrollment
		const result = await executeQuery(
			"DELETE FROM class_enrollments WHERE class_id = ? AND student_id = ?",
			[id, studentId]
		);

		if (result.affectedRows === 0) {
			return res
				.status(404)
				.json({ message: "Student not found in this class" });
		}

		res.json({ message: "Student removed successfully" });
	} catch (error) {
		console.error("Remove student error:", error);
		res.status(500).json({ message: "Failed to remove student" });
	}
});

module.exports = router;
