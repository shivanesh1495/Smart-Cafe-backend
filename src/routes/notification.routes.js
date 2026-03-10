const express = require('express');
const router = express.Router();
const { notificationController } = require('../controllers');
const { authenticate, isStaff, isManagement } = require('../middlewares');

// All routes require authentication
router.use(authenticate);

// User routes
router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Staff routes - Emergency announcements
router.post('/emergency', isStaff, notificationController.sendEmergency);

// Admin routes - Notification log
router.get('/log', isManagement, notificationController.getNotificationLog);

// Management routes - Broadcast
router.post('/broadcast', isStaff, notificationController.sendBroadcast);

module.exports = router;
