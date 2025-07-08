const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { executeQuery } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
	storage: storage,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = [
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(
				new Error(
					"Invalid file type. Only PDF, DOC, and DOCX files are allowed."
				)
			);
		}
	},
});

// Upload file
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: "No file uploaded" });
		}

		const { fileType } = req.body;
		const userId = req.session.user.id;

		// Generate file hash for deduplication
		const fileHash = crypto
			.createHash("sha256")
			.update(req.file.buffer)
			.digest("hex");

		// Check if file already exists
		const existingFile = await executeQuery(
			"SELECT id FROM uploaded_files WHERE user_id = ? AND file_hash = ?",
			[userId, fileHash]
		);

		if (existingFile.length > 0) {
			return res
				.status(400)
				.json({ message: "This file has already been uploaded" });
		}

		// Insert file into database
		const result = await executeQuery(
			`INSERT INTO uploaded_files (user_id, file_name, original_name, file_type, file_size, file_data, file_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				userId,
				`${Date.now()}_${req.file.originalname}`,
				req.file.originalname,
				fileType || "document",
				req.file.size,
				req.file.buffer,
				fileHash,
			]
		);

		res.json({
			message: "File uploaded successfully",
			fileId: result.insertId,
			fileName: req.file.originalname,
		});
	} catch (error) {
		console.error("File upload error:", error);
		res.status(500).json({ message: "Failed to upload file" });
	}
});

// Get user's files
router.get("/", requireAuth, async (req, res) => {
	try {
		const userId = req.session.user.id;

		const files = await executeQuery(
			`SELECT id, file_name, original_name as original_filename, file_type, file_size, upload_date as uploaded_at, is_primary
             FROM uploaded_files 
             WHERE user_id = ? 
             ORDER BY upload_date DESC`,
			[userId]
		);

		res.json(files);
	} catch (error) {
		console.error("Get files error:", error);
		res.status(500).json({ message: "Failed to get files" });
	}
});

// Download file
router.get("/:fileId", requireAuth, async (req, res) => {
	try {
		const { fileId } = req.params;
		const userId = req.session.user.id;

		// Check if user can access this file
		const canAccess =
			req.session.user.role === "admin" || req.session.user.role === "teacher";

		let query, params;
		if (canAccess) {
			// Teachers and admins can access any file
			query = "SELECT * FROM uploaded_files WHERE id = ?";
			params = [fileId];
		} else {
			// Students can only access their own files
			query = "SELECT * FROM uploaded_files WHERE id = ? AND user_id = ?";
			params = [fileId, userId];
		}

		const files = await executeQuery(query, params);

		if (files.length === 0) {
			return res.status(404).json({ message: "File not found" });
		}

		const file = files[0];

		// Set appropriate headers
		res.setHeader("Content-Type", getContentType(file.original_name));
		res.setHeader(
			"Content-Disposition",
			`inline; filename="${file.original_name}"`
		);
		res.setHeader("Content-Length", file.file_size);

		// Send file data
		res.send(file.file_data);
	} catch (error) {
		console.error("File download error:", error);
		res.status(500).json({ message: "Failed to download file" });
	}
});

// Delete file
router.delete("/:fileId", requireAuth, async (req, res) => {
	try {
		const { fileId } = req.params;
		const userId = req.session.user.id;

		// Check if user can delete this file
		const canDelete = req.session.user.role === "admin";

		let query, params;
		if (canDelete) {
			query = "DELETE FROM uploaded_files WHERE id = ?";
			params = [fileId];
		} else {
			// Students can only delete their own files
			query = "DELETE FROM uploaded_files WHERE id = ? AND user_id = ?";
			params = [fileId, userId];
		}

		const result = await executeQuery(query, params);

		if (result.affectedRows === 0) {
			return res
				.status(404)
				.json({ message: "File not found or access denied" });
		}

		res.json({ message: "File deleted successfully" });
	} catch (error) {
		console.error("File delete error:", error);
		res.status(500).json({ message: "Failed to delete file" });
	}
});

// Helper function to get content type
function getContentType(filename) {
	const ext = filename.toLowerCase().split(".").pop();
	switch (ext) {
		case "pdf":
			return "application/pdf";
		case "doc":
			return "application/msword";
		case "docx":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
		default:
			return "application/octet-stream";
	}
}

module.exports = router;
