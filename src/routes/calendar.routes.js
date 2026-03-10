const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin, isManagement, isAuthenticated } = require('../middlewares/rbac.middleware');
const calendarController = require('../controllers/calendar.controller');

// Public — active events for current date
router.get('/active', authenticate, isAuthenticated, calendarController.getActiveEvents);

// Admin/Management — full CRUD
router.get('/', authenticate, isManagement, calendarController.getAllEvents);
router.post('/', authenticate, isAdmin, calendarController.createEvent);
router.put('/:id', authenticate, isAdmin, calendarController.updateEvent);
router.delete('/:id', authenticate, isAdmin, calendarController.deleteEvent);

// Demand adjustment for a date
router.get('/demand-adjustment', authenticate, isManagement, calendarController.getDemandAdjustment);

module.exports = router;
