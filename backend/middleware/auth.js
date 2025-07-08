// Authentication middleware
const requireAuth = (req, res, next) => {
	if (req.session.userId && req.session.user) {
		next();
	} else {
		res.status(401).json({
			authenticated: false,
			message: "Authentication required",
		});
	}
};

// Role-based authentication middleware
const requireRole = (roles) => {
	return (req, res, next) => {
		if (!req.session.userId || !req.session.user) {
			return res.status(401).json({
				authenticated: false,
				message: "Authentication required",
			});
		}

		const userRole = req.session.user.role;
		if (!roles.includes(userRole)) {
			return res.status(403).json({
				message: "Insufficient permissions",
			});
		}

		next();
	};
};

// Check if user is a teacher
const requireTeacher = requireRole(["teacher", "admin"]);

// Check if user is a student
const requireStudent = requireRole(["student"]);

// Check if user is an admin
const requireAdmin = requireRole(["admin"]);

module.exports = {
	requireAuth,
	requireRole,
	requireTeacher,
	requireStudent,
	requireAdmin,
};
