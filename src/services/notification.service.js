const { Notification, User } = require("../models");
const ApiError = require("../utils/ApiError");

/**
 * Create notification for a specific user
 */
const createNotification = async (data) => {
  const notification = await Notification.create({
    user: data.userId,
    title: data.title,
    message: data.message,
    type: data.type || "system",
    data: data.link ? { link: data.link } : undefined,
  });

  return notification;
};

/**
 * Get notifications for a user
 */
const getUserNotifications = async (userId, query = {}) => {
  const { limit = 20, unreadOnly = false, type } = query;

  const filter = { user: userId };
  if (unreadOnly) {
    filter.isRead = false;
  }
  if (type) {
    filter.type = type;
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  return notifications;
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  notification.isRead = true;
  await notification.save();

  return notification;
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );

  return { markedCount: result.modifiedCount };
};

/**
 * Send broadcast notification to all users or by role
 */
const sendBroadcast = async (data) => {
  const { title, message, type = "announcement", roles, sentBy, sentByName } = data;

  // Find target users
  let filter = { status: "active" };
  if (roles && roles.length > 0) {
    filter.role = { $in: roles };
  }

  const users = await User.find(filter).select("_id");

  // Create notifications for all users
  const notifications = users.map((user) => ({
    user: user._id,
    title,
    message,
    type: type,
    broadcast: true,
    targetRoles: roles || [],
    sentBy: sentBy || null,
    sentByName: sentByName || null,
  }));

  await Notification.insertMany(notifications);

  return {
    recipientCount: users.length,
    title,
    message,
    targetRoles: roles || [],
    sentAt: new Date(),
  };
};

/**
 * Send emergency announcement (high priority broadcast)
 */
const sendEmergencyAnnouncement = async (data) => {
  const result = await sendBroadcast({
    title: `🚨 ${data.title}`,
    message: data.message,
    type: "alert",
    roles: data.roles, // Optional: target specific roles
    sentBy: data.sentBy,
    sentByName: data.sentByName,
  });

  return result;
};

/**
 * Delete notification
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  return { deleted: true };
};

/**
 * Get unread count for user
 */
const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({
    user: userId,
    isRead: false,
  });

  return { unreadCount: count };
};

/**
 * Get all notifications log for admin (shows sender/receiver info)
 */
const getAllNotificationsLog = async (query = {}) => {
  const { page = 1, limit = 50, type } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { broadcast: true };
  if (type) {
    filter.type = type;
  }

  // Group by broadcast batch (same title, message, sentBy, createdAt within 2s)
  const logs = await Notification.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          title: "$title",
          message: "$message",
          sentBy: "$sentBy",
          sentByName: "$sentByName",
          type: "$type",
          targetRoles: "$targetRoles",
          // Group notifications sent within the same second
          timestamp: {
            $dateToString: { format: "%Y-%m-%dT%H:%M:%S", date: "$createdAt" },
          },
        },
        recipientCount: { $sum: 1 },
        createdAt: { $first: "$createdAt" },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $project: {
        _id: 0,
        title: "$_id.title",
        message: "$_id.message",
        sentBy: "$_id.sentBy",
        sentByName: "$_id.sentByName",
        type: "$_id.type",
        targetRoles: "$_id.targetRoles",
        recipientCount: 1,
        createdAt: 1,
      },
    },
  ]);

  // Count total unique broadcasts
  const totalResult = await Notification.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          title: "$title",
          message: "$message",
          sentBy: "$sentBy",
          timestamp: {
            $dateToString: { format: "%Y-%m-%dT%H:%M:%S", date: "$createdAt" },
          },
        },
      },
    },
    { $count: "total" },
  ]);

  const total = totalResult[0]?.total || 0;

  return { logs, total, page: parseInt(page), limit: parseInt(limit) };
};

/**
 * Schedule a slot reminder 10 minutes before the slot start time
 */
const scheduleSlotReminder = async (booking, slot) => {
  if (!slot || !slot.time || !slot.date) return;

  // Parse slot start time
  const slotDate = new Date(slot.date);
  const timeParts = slot.time.split(':');
  if (timeParts.length >= 2) {
    slotDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
  }

  // Schedule 10 minutes before
  const reminderTime = new Date(slotDate.getTime() - 10 * 60000);

  // Only schedule if reminder time is in the future
  if (reminderTime > new Date()) {
    await Notification.create({
      user: booking.user,
      type: 'order',
      title: '⏰ Slot Reminder',
      message: `Your meal slot starts in 10 minutes! Token: ${booking.tokenNumber}. Please head to the canteen.`,
      data: { bookingId: booking._id, slotId: slot._id, tokenNumber: booking.tokenNumber },
      scheduledFor: reminderTime,
      isSent: false,
    });
  }
};

/**
 * Process and send all due scheduled reminders (call this from a cron job)
 */
const processScheduledReminders = async () => {
  const now = new Date();

  const dueReminders = await Notification.find({
    scheduledFor: { $lte: now },
    isSent: false,
  });

  let processed = 0;
  for (const reminder of dueReminders) {
    reminder.isSent = true;
    await reminder.save();
    processed++;

    // Emit via socket if available
    try {
      const { emitToUser } = require('../utils/socketEmitter');
      if (emitToUser) {
        emitToUser(reminder.user.toString(), 'notification:new', {
          id: reminder._id,
          title: reminder.title,
          message: reminder.message,
          type: reminder.type,
        });
      }
    } catch {
      // Socket not available, notification saved for polling
    }
  }

  return { processed, timestamp: now };
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  sendBroadcast,
  sendEmergencyAnnouncement,
  deleteNotification,
  getUnreadCount,
  getAllNotificationsLog,
  scheduleSlotReminder,
  processScheduledReminders,
};
