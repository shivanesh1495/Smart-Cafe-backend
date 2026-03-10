const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holiday.controller');
const { authenticate, isAdmin } = require('../middlewares');

// All routes require authentication
router.use(authenticate);

// Public routes (for all authenticated users)
router.get('/upcoming', holidayController.getUpcomingHolidays);
router.get('/check', holidayController.checkHoliday);

// Admin routes
router.get('/', isAdmin, holidayController.getHolidays);
router.post('/', isAdmin, holidayController.createHoliday);
router.put('/:id', isAdmin, holidayController.updateHoliday);
router.delete('/:id', isAdmin, holidayController.deleteHoliday);

module.exports = router;
