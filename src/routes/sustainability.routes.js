const express = require('express');
const router = express.Router();
const sustainabilityController = require('../controllers/sustainability.controller');
const { authenticate, isManagement, isStaff } = require('../middlewares');

// All routes require authentication
router.use(authenticate);

// User routes
router.post('/waste-report', sustainabilityController.submitWasteReport);
router.get('/my-reports', sustainabilityController.getMyWasteReports);

// Available to all authenticated users (personal eco-score)
router.get('/metrics', sustainabilityController.getSustainabilityMetrics);

// Donation routes
router.get('/donations', sustainabilityController.getDonationHistory);
router.post('/donations', isStaff, sustainabilityController.logDonation);

// Management routes
router.get('/reports', isManagement, sustainabilityController.getAllWasteReports);
router.get('/stats', isManagement, sustainabilityController.getWasteStats);

module.exports = router;

