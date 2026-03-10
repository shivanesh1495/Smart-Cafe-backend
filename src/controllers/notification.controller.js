const { notificationService } = require('../services');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');
const { emitToAll } = require('../utils/socketEmitter');

/**
 * Get user's notifications
 * GET /api/notifications
 */
const getNotifications = catchAsync(async (req, res) => {
  const notifications = await notificationService.getUserNotifications(
    req.userId,
    req.query
  );
  
  ApiResponse.ok(res, 'Notifications retrieved', notifications);
});

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = catchAsync(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.userId);
  
  ApiResponse.ok(res, 'Unread count retrieved', result);
});

/**
 * Mark notification as read
 * POST /api/notifications/:id/read
 */
const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.params.id,
    req.userId
  );
  
  ApiResponse.ok(res, 'Notification marked as read', notification);
});

/**
 * Mark all notifications as read
 * POST /api/notifications/read-all
 */
const markAllAsRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.userId);
  
  ApiResponse.ok(res, 'All notifications marked as read', result);
});

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = catchAsync(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.userId);
  
  ApiResponse.ok(res, 'Notification deleted');
});

/**
 * Send broadcast notification (Management only)
 * POST /api/notifications/broadcast
 */
const sendBroadcast = catchAsync(async (req, res) => {
  const result = await notificationService.sendBroadcast({
    ...req.body,
    sentBy: req.userId,
    sentByName: req.user?.fullName || 'Unknown',
  });
  
  emitToAll('notification:broadcast', { type: 'broadcast', ...result });
  ApiResponse.created(res, 'Broadcast sent', result);
});

/**
 * Send emergency announcement (Staff only)
 * POST /api/notifications/emergency
 */
const sendEmergency = catchAsync(async (req, res) => {
  const result = await notificationService.sendEmergencyAnnouncement({
    ...req.body,
    sentBy: req.userId,
    sentByName: req.user?.fullName || 'Unknown',
  });
  
  emitToAll('notification:broadcast', { type: 'emergency', ...result });
  ApiResponse.created(res, 'Emergency announcement sent', result);
});

/**
 * Get notification log for admin
 * GET /api/notifications/log
 */
const getNotificationLog = catchAsync(async (req, res) => {
  const result = await notificationService.getAllNotificationsLog(req.query);
  
  ApiResponse.ok(res, 'Notification log retrieved', result);
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendBroadcast,
  sendEmergency,
  getNotificationLog,
};
