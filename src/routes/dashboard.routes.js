const express = require('express');
const router = express.Router();
const { dashboardController } = require('../controllers');
const { authenticate, isAdmin, isManagement, isStaff, authorize } = require('../middlewares');

// All routes require authentication
router.use(authenticate);

// Role-specific dashboards
router.get('/admin', isAdmin, dashboardController.getAdminDashboard);
router.get('/manager', isManagement, dashboardController.getManagerDashboard);
router.get('/staff', isStaff, dashboardController.getStaffDashboard);
router.get('/student', authorize('user'), dashboardController.getStudentDashboard);

module.exports = router;
