const express = require("express");
const { executeQuery } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// Create a new survey (Teachers/Admins only)
router.post("/", requireAuth, async (req, res) => {
	try {
		const {
			title,
			description,
			survey_data,
			template_name,
			is_template,
			open_date,
			close_date,
		} = req.body;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can create surveys" });
		}

		if (!title || !survey_data) {
			return res
				.status(400)
				.json({ message: "Title and survey data are required" });
		}

		const result = await executeQuery(
			`INSERT INTO surveys (title, description, teacher_id, survey_data, template_name, is_template, open_date, close_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				title,
				description || null,
				req.session.user.id,
				JSON.stringify(survey_data),
				template_name || null,
				is_template || false,
				open_date || null,
				close_date || null,
			]
		);

		res.status(201).json({
			message: "Survey created successfully",
			surveyId: result.insertId,
			survey: {
				id: result.insertId,
				title,
				description,
				teacher_id: req.session.user.id,
				survey_data,
				template_name,
				is_template: is_template || false,
				open_date,
				close_date,
				active: true,
			},
		});
	} catch (error) {
		console.error("Create survey error:", error);
		res.status(500).json({ message: "Failed to create survey" });
	}
});

// Get all surveys (role-based access)
router.get("/", requireAuth, async (req, res) => {
	try {
		const { active, template } = req.query;
		const userId = req.session.user.id;
		const userRole = req.session.user.role;

		let query = `
            SELECT s.*, 
                   CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                   COUNT(DISTINCT sa.class_id) as assigned_classes,
                   COUNT(DISTINCT sr.student_id) as total_responses,
                   COUNT(DISTINCT CASE WHEN sr.is_complete = 1 THEN sr.student_id END) as completed_responses
            FROM surveys s
            JOIN users u ON s.teacher_id = u.id
            LEFT JOIN survey_assignments sa ON s.id = sa.survey_id
            LEFT JOIN survey_responses sr ON s.id = sr.survey_id
        `;

		let params = [];
		let conditions = [];

		// Role-based filtering
		if (userRole === "student") {
			// Students only see surveys assigned to their classes
			query += ` 
                JOIN survey_assignments sa2 ON s.id = sa2.survey_id
                JOIN class_enrollments ce ON sa2.class_id = ce.class_id
            `;
			conditions.push("ce.student_id = ?");
			params.push(userId);
		} else if (userRole === "teacher") {
			// Teachers see their own surveys
			conditions.push("s.teacher_id = ?");
			params.push(userId);
		}
		// Admins see all surveys (no additional conditions)

		// Additional filters
		if (active !== undefined) {
			conditions.push("s.active = ?");
			params.push(active === "true" ? 1 : 0);
		}

		if (template !== undefined) {
			conditions.push("s.is_template = ?");
			params.push(template === "true" ? 1 : 0);
		}

		if (conditions.length > 0) {
			query += " WHERE " + conditions.join(" AND ");
		}

		query += " GROUP BY s.id ORDER BY s.created_at DESC";

		const surveys = await executeQuery(query, params);

		// Parse survey_data JSON
		const formattedSurveys = surveys.map((survey) => ({
			...survey,
			survey_data: JSON.parse(survey.survey_data),
		}));

		res.json(formattedSurveys);
	} catch (error) {
		console.error("Get surveys error:", error);
		res.status(500).json({ message: "Failed to get surveys" });
	}
});

// Get a specific survey
router.get("/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.session.user.id;
		const userRole = req.session.user.role;

		let query = `
            SELECT s.*, 
                   CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                   u.email as teacher_email
            FROM surveys s
            JOIN users u ON s.teacher_id = u.id
            WHERE s.id = ?
        `;

		const surveys = await executeQuery(query, [id]);

		if (surveys.length === 0) {
			return res.status(404).json({ message: "Survey not found" });
		}

		const survey = surveys[0];

		// Check access permissions
		if (userRole === "student") {
			// Check if student has access to this survey
			const access = await executeQuery(
				`SELECT 1 FROM survey_assignments sa
                 JOIN class_enrollments ce ON sa.class_id = ce.class_id
                 WHERE sa.survey_id = ? AND ce.student_id = ?`,
				[id, userId]
			);

			if (access.length === 0) {
				return res
					.status(403)
					.json({ message: "You do not have access to this survey" });
			}
		} else if (userRole === "teacher" && survey.teacher_id !== userId) {
			return res
				.status(403)
				.json({ message: "You can only access your own surveys" });
		}

		// If student, check if they have already responded
		let userResponse = null;
		if (userRole === "student") {
			const responses = await executeQuery(
				"SELECT * FROM survey_responses WHERE survey_id = ? AND student_id = ?",
				[id, userId]
			);

			if (responses.length > 0) {
				userResponse = {
					...responses[0],
					response_data: JSON.parse(responses[0].response_data),
				};
			}
		}

		res.json({
			...survey,
			survey_data: JSON.parse(survey.survey_data),
			user_response: userResponse,
		});
	} catch (error) {
		console.error("Get survey error:", error);
		res.status(500).json({ message: "Failed to get survey" });
	}
});

// Update a survey (Teachers/Admins only)
router.put("/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const {
			title,
			description,
			survey_data,
			template_name,
			is_template,
			open_date,
			close_date,
			active,
		} = req.body;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can update surveys" });
		}

		// Check if survey exists and user has permission
		const surveys = await executeQuery("SELECT * FROM surveys WHERE id = ?", [
			id,
		]);
		if (surveys.length === 0) {
			return res.status(404).json({ message: "Survey not found" });
		}

		const survey = surveys[0];
		if (
			req.session.user.role === "teacher" &&
			survey.teacher_id !== req.session.user.id
		) {
			return res
				.status(403)
				.json({ message: "You can only update your own surveys" });
		}

		// Update survey
		await executeQuery(
			`UPDATE surveys 
             SET title = ?, description = ?, survey_data = ?, template_name = ?, 
                 is_template = ?, open_date = ?, close_date = ?, active = ?
             WHERE id = ?`,
			[
				title || survey.title,
				description !== undefined ? description : survey.description,
				survey_data ? JSON.stringify(survey_data) : survey.survey_data,
				template_name !== undefined ? template_name : survey.template_name,
				is_template !== undefined ? is_template : survey.is_template,
				open_date !== undefined ? open_date : survey.open_date,
				close_date !== undefined ? close_date : survey.close_date,
				active !== undefined ? active : survey.active,
				id,
			]
		);

		res.json({ message: "Survey updated successfully" });
	} catch (error) {
		console.error("Update survey error:", error);
		res.status(500).json({ message: "Failed to update survey" });
	}
});

// Delete a survey (Teachers/Admins only)
router.delete("/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can delete surveys" });
		}

		// Check if survey exists and user has permission
		const surveys = await executeQuery("SELECT * FROM surveys WHERE id = ?", [
			id,
		]);
		if (surveys.length === 0) {
			return res.status(404).json({ message: "Survey not found" });
		}

		const survey = surveys[0];
		if (
			req.session.user.role === "teacher" &&
			survey.teacher_id !== req.session.user.id
		) {
			return res
				.status(403)
				.json({ message: "You can only delete your own surveys" });
		}

		// Delete survey (cascade will handle related records)
		await executeQuery("DELETE FROM surveys WHERE id = ?", [id]);

		res.json({ message: "Survey deleted successfully" });
	} catch (error) {
		console.error("Delete survey error:", error);
		res.status(500).json({ message: "Failed to delete survey" });
	}
});

// Assign survey to class (Teachers/Admins only)
router.post("/:id/assign", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const { class_id } = req.body;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can assign surveys" });
		}

		if (!class_id) {
			return res.status(400).json({ message: "Class ID is required" });
		}

		// Check if survey exists and user has permission
		const surveys = await executeQuery("SELECT * FROM surveys WHERE id = ?", [
			id,
		]);
		if (surveys.length === 0) {
			return res.status(404).json({ message: "Survey not found" });
		}

		const survey = surveys[0];
		if (
			req.session.user.role === "teacher" &&
			survey.teacher_id !== req.session.user.id
		) {
			return res
				.status(403)
				.json({ message: "You can only assign your own surveys" });
		}

		// Check if class exists
		const classes = await executeQuery("SELECT * FROM classes WHERE id = ?", [
			class_id,
		]);
		if (classes.length === 0) {
			return res.status(404).json({ message: "Class not found" });
		}

		// Check if assignment already exists
		const existingAssignment = await executeQuery(
			"SELECT * FROM survey_assignments WHERE survey_id = ? AND class_id = ?",
			[id, class_id]
		);

		if (existingAssignment.length > 0) {
			return res
				.status(400)
				.json({ message: "Survey is already assigned to this class" });
		}

		// Create assignment
		await executeQuery(
			"INSERT INTO survey_assignments (survey_id, class_id) VALUES (?, ?)",
			[id, class_id]
		);

		res.json({ message: "Survey assigned successfully" });
	} catch (error) {
		console.error("Assign survey error:", error);
		res.status(500).json({ message: "Failed to assign survey" });
	}
});

// Submit survey response (Students only)
router.post("/:id/respond", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const { response_data, is_complete } = req.body;

		// Check if user is student
		if (req.session.user.role !== "student") {
			return res
				.status(403)
				.json({ message: "Only students can submit survey responses" });
		}

		if (!response_data) {
			return res.status(400).json({ message: "Response data is required" });
		}

		const userId = req.session.user.id;

		// Check if student has access to this survey
		const access = await executeQuery(
			`SELECT 1 FROM survey_assignments sa
             JOIN class_enrollments ce ON sa.class_id = ce.class_id
             WHERE sa.survey_id = ? AND ce.student_id = ?`,
			[id, userId]
		);

		if (access.length === 0) {
			return res
				.status(403)
				.json({ message: "You do not have access to this survey" });
		}

		// Check if response already exists
		const existingResponse = await executeQuery(
			"SELECT * FROM survey_responses WHERE survey_id = ? AND student_id = ?",
			[id, userId]
		);

		if (existingResponse.length > 0) {
			// Update existing response
			await executeQuery(
				`UPDATE survey_responses 
                 SET response_data = ?, is_complete = ?, completed_at = ?
                 WHERE survey_id = ? AND student_id = ?`,
				[
					JSON.stringify(response_data),
					is_complete || false,
					is_complete ? new Date() : null,
					id,
					userId,
				]
			);
		} else {
			// Create new response
			await executeQuery(
				`INSERT INTO survey_responses (survey_id, student_id, response_data, is_complete, completed_at, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					id,
					userId,
					JSON.stringify(response_data),
					is_complete || false,
					is_complete ? new Date() : null,
					req.ip || null,
					req.get("User-Agent") || null,
				]
			);
		}

		res.json({ message: "Response saved successfully" });
	} catch (error) {
		console.error("Submit response error:", error);
		res.status(500).json({ message: "Failed to submit response" });
	}
});

// Get survey responses (Teachers/Admins only)
router.get("/:id/responses", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;

		// Check if user is teacher or admin
		if (
			req.session.user.role !== "teacher" &&
			req.session.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ message: "Only teachers and admins can view responses" });
		}

		// Check if survey exists and user has permission
		const surveys = await executeQuery("SELECT * FROM surveys WHERE id = ?", [
			id,
		]);
		if (surveys.length === 0) {
			return res.status(404).json({ message: "Survey not found" });
		}

		const survey = surveys[0];
		if (
			req.session.user.role === "teacher" &&
			survey.teacher_id !== req.session.user.id
		) {
			return res
				.status(403)
				.json({ message: "You can only view responses for your own surveys" });
		}

		// Get all responses with student information
		const responses = await executeQuery(
			`SELECT sr.*, 
                    CONCAT(u.first_name, ' ', u.last_name) as student_name,
                    u.email as student_email,
                    sp.student_id as student_number
             FROM survey_responses sr
             JOIN users u ON sr.student_id = u.id
             LEFT JOIN student_profiles sp ON u.id = sp.user_id
             WHERE sr.survey_id = ?
             ORDER BY sr.started_at DESC`,
			[id]
		);

		// Parse response data
		const formattedResponses = responses.map((response) => ({
			...response,
			response_data: JSON.parse(response.response_data),
		}));

		res.json(formattedResponses);
	} catch (error) {
		console.error("Get responses error:", error);
		res.status(500).json({ message: "Failed to get responses" });
	}
});

module.exports = router;
