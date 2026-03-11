const { Booking, Notification, User } = require("../models");
const financialService = require("../services/financial.service");
const { getIO } = require("../socket");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");

/**
 * Send announcement to all users with active (confirmed) bookings
 * POST /api/staff/announcement
 */
const sendAnnouncement = catchAsync(async (req, res) => {
  const { message } = req.body || {};

  if (!message || !message.toString().trim()) {
    return ApiResponse.badRequest(res, "Message is required");
  }

  // Broadcast to all active users (not just users with active bookings)
  const users = await User.find({ status: "active" }).select("_id");
  const userIds = users.map((u) => u._id.toString());

  if (userIds.length === 0) {
    return ApiResponse.ok(res, "No active users to notify", {
      notificationsSent: 0,
    });
  }

  // Create notifications for each user
  const notifications = userIds.map((userId) => ({
    user: userId,
    type: "announcement",
    title: "Staff Announcement",
    message: message.toString().trim(),
    broadcast: true,
    sentBy: req.userId || null,
  }));

  await Notification.insertMany(notifications);

  ApiResponse.created(res, "Announcement sent", {
    notificationsSent: notifications.length,
    timestamp: new Date(),
  });
});

/**
 * Get announcement history
 * GET /api/staff/announcement
 */
const getAnnouncements = catchAsync(async (req, res) => {
  const announcements = await Notification.aggregate([
    { $match: { type: "announcement" } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$message",
        createdAt: { $first: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
  ]);

  ApiResponse.ok(
    res,
    "Announcements retrieved",
    announcements.map((a) => ({
      message: a._id,
      sentAt: a.createdAt,
      recipientCount: a.count,
    })),
  );
});

/**
 * Get live queue status for upcoming slots
 * GET /api/staff/queue-status
 */
const getQueueStatus = catchAsync(async (req, res) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Get today's bookings grouped by status
  const stats = await Booking.aggregate([
    {
      $lookup: {
        from: "slots",
        localField: "slot",
        foreignField: "_id",
        as: "slotData",
      },
    },
    { $unwind: "$slotData" },
    {
      $match: {
        "slotData.date": {
          $gte: new Date(todayStr),
          $lt: new Date(new Date(todayStr).getTime() + 24 * 60 * 60 * 1000),
        },
      },
    },
    {
      $group: {
        _id: {
          slotId: "$slot",
          slotTime: "$slotData.time",
          mealType: "$slotData.mealType",
        },
        waiting: {
          $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
        },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        noShows: {
          $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
        },
      },
    },
    { $sort: { "_id.slotTime": 1 } },
  ]);

  const queueStatus = stats.map((s) => ({
    slotTime: s._id.slotTime,
    mealType: s._id.mealType,
    waiting: s.waiting,
    completed: s.completed,
    noShows: s.noShows,
  }));

  ApiResponse.ok(res, "Queue status retrieved", {
    currentTime: now,
    queueStatus,
  });
});

/**
 * Log quick manual cash entry from the sidebar
 * POST /api/staff/cash
 */
const logManualCash = catchAsync(async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return ApiResponse.badRequest(res, "Amount must be greater than zero");
  }

  const staffUser = await User.findById(req.userId);
  if (!staffUser) {
    return ApiResponse.notFound(res, "Staff user not found");
  }

  // Admin users might not have a canteenId, or they can log for a specific canteen if passed.
  // Assuming this is used by canteen_staff who have a `canteenId`.
  const targetCanteenId = staffUser.canteenId;
  if (!targetCanteenId && staffUser.role !== "admin") {
    return ApiResponse.badRequest(
      res,
      "Staff member is not assigned to any canteen",
    );
  }

  const canteenIdString = targetCanteenId ? targetCanteenId.toString() : null;
  const staffName = staffUser.fullName || staffUser.name || "Staff";

  await financialService.recordCashSale(
    amount,
    `Manual cash entry by staff ${staffName}`,
    canteenIdString,
    staffUser._id,
  );

  // Emit websocket event so dashboards refresh immediately.
  const io = getIO();
  if (io && canteenIdString) {
    const payload = {
      action: "cash_entry",
      amount,
      canteenId: canteenIdString,
      source: "staff_manual_cash",
    };

    io.to(canteenIdString).emit("booking:updated", payload);
    io.to("role:manager").emit("booking:updated", payload);
    io.to("role:admin").emit("booking:updated", payload);
  }

  ApiResponse.created(res, "Cash entry logged successfully");
});

module.exports = {
  sendAnnouncement,
  getAnnouncements,
  getQueueStatus,
  logManualCash,
};
