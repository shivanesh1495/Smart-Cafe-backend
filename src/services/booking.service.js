const mongoose = require("mongoose");
const { Booking, Slot, MenuItem, SystemSetting, User } = require("../models");
const {
  parsePagination,
  paginateResponse,
  getDayBounds,
} = require("../utils/helpers");
const slotService = require("./slot.service");
const notificationService = require("./notification.service");
const financialService = require("./financial.service");
const ApiError = require("../utils/ApiError");

const POLICY_KEYS = {
  maxBookingsPerDay: "MAX_BOOKINGS_PER_STUDENT_PER_DAY",
  peakBookingWindow: "PEAK_BOOKING_WINDOW_MINS",
  tokenExpiry: "TOKEN_EXPIRY_DURATION_MINS",
  noShowGrace: "NO_SHOW_GRACE_PERIOD_MINS",
  noShowPenalty: "NO_SHOW_PENALTY_DAYS",
};

const SETTING_KEYS = {
  masterBookingEnabled: "MASTER_BOOKING_ENABLED",
  onlineBookingEnabled: "ONLINE_BOOKING_ENABLED",
  walkinEnabled: "WALKIN_ENABLED",
  slotDuration: "SLOT_DURATION",
  operatingSchedule: "OPERATING_SCHEDULE",
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const getPolicyNumber = async (key, fallback) => {
  const value = await SystemSetting.getValue(key);
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const getSettingNumber = async (key, fallback) => {
  const value = await SystemSetting.getValue(key);
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const getSettingBoolean = async (key, fallback) => {
  const value = await SystemSetting.getValue(key);
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

const getSettingJson = async (key) => {
  const value = await SystemSetting.getValue(key);
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const parseSlotDateTime = (slot, useEndTime = false) => {
  if (!slot?.date || !slot?.time) return null;

  const slotDateTime = new Date(slot.date);
  let timeText = String(slot.time).trim();

  if (timeText.includes("-")) {
    const parts = timeText
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean);
    timeText = useEndTime ? parts[1] || parts[0] : parts[0];
  }

  const match = timeText.match(/^(\d{1,2}):(\d{2})(\s*[AP]M)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.trim().toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  slotDateTime.setHours(hours, minutes, 0, 0);
  return slotDateTime;
};

const parseTimeToMinutes = (timeText) => {
  const match = String(timeText || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getOperatingStatus = async (date = new Date()) => {
  const schedule = await getSettingJson(SETTING_KEYS.operatingSchedule);
  if (!Array.isArray(schedule)) {
    return { isOpen: true };
  }

  const dayName = DAY_NAMES[date.getDay()];
  const entry = schedule.find((item) => item?.day === dayName);
  if (!entry) {
    return { isOpen: true };
  }

  if (entry.isHoliday) {
    return { isOpen: false, reason: `${dayName} is a holiday` };
  }

  if (entry.isOpen === false) {
    return { isOpen: false, reason: `${dayName} is closed` };
  }

  const openMinutes = parseTimeToMinutes(entry.openTime);
  const closeMinutes = parseTimeToMinutes(entry.closeTime);
  if (openMinutes === null || closeMinutes === null) {
    return { isOpen: true };
  }

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  if (nowMinutes < openMinutes || nowMinutes > closeMinutes) {
    return {
      isOpen: false,
      reason: `Service is closed. Hours: ${entry.openTime} - ${entry.closeTime}`,
    };
  }

  return { isOpen: true };
};

const ensureServiceOpen = async (mode) => {
  const masterEnabled = await getSettingBoolean(
    SETTING_KEYS.masterBookingEnabled,
    true,
  );
  if (!masterEnabled) {
    throw ApiError.forbidden("System under maintenance");
  }

  if (mode === "online") {
    const enabled = await getSettingBoolean(
      SETTING_KEYS.onlineBookingEnabled,
      true,
    );
    if (!enabled) {
      throw ApiError.forbidden("Online booking is currently disabled");
    }
  }

  if (mode === "walkin") {
    const enabled = await getSettingBoolean(SETTING_KEYS.walkinEnabled, true);
    if (!enabled) {
      throw ApiError.forbidden("Walk-in service is currently disabled");
    }
  }

  const status = await getOperatingStatus(new Date());
  if (!status.isOpen) {
    throw ApiError.forbidden(status.reason || "Service is closed");
  }
};

const getSlotEndTime = async (slot) => {
  if (!slot) return null;
  const endTime = parseSlotDateTime(slot, true);
  if (endTime) return endTime;
  const startTime = parseSlotDateTime(slot, false);
  if (!startTime) return null;
  const durationMins = await getSettingNumber(SETTING_KEYS.slotDuration, 15);
  return new Date(startTime.getTime() + durationMins * 60000);
};

const ensureSameDayBooking = (slotDate) => {
  const now = new Date();
  if (!isSameDay(slotDate, now)) {
    throw ApiError.badRequest("Bookings are allowed only for today's slots");
  }
};

const aggregateRequestedItems = (items = []) => {
  const grouped = new Map();

  for (const item of items) {
    const menuItemId = (item?.menuItemId || item?.menuItem || "").toString();
    if (!menuItemId) continue;

    const quantity = Math.max(1, Number(item.quantity) || 1);
    grouped.set(menuItemId, (grouped.get(menuItemId) || 0) + quantity);
  }

  return Array.from(grouped.entries()).map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
};

const getMenuItemsByRequest = async (requestedItems) => {
  const ids = requestedItems.map((item) => item.menuItemId);
  const menuItems = await MenuItem.find({
    _id: { $in: ids },
  });

  const byId = new Map(menuItems.map((item) => [item._id.toString(), item]));

  for (const { menuItemId } of requestedItems) {
    if (!byId.has(menuItemId)) {
      throw ApiError.badRequest(`Menu item not found: ${menuItemId}`);
    }
  }

  return byId;
};

const reserveMenuStock = async (requestedItems, menuItemsById) => {
  const reserved = [];
  const maxRetries = 3;
  let lastError;

  // Initialize missing availableQuantity in database for backward compatibility
  // Mongoose schema defaults hide missing DB fields, so we fix them at DB level first.
  const ids = requestedItems.map((item) => item.menuItemId);
  await MenuItem.updateMany(
    { _id: { $in: ids }, availableQuantity: { $exists: false } },
    { $set: { availableQuantity: 100 } },
  );

  try {
    for (const { menuItemId, quantity } of requestedItems) {
      let menuItem = menuItemsById.get(menuItemId);

      if (!menuItem.isAvailable) {
        throw ApiError.badRequest(`${menuItem.itemName} is not available`);
      }

      const availableQuantity = Number(menuItem.availableQuantity || 0);
      if (availableQuantity < quantity) {
        throw ApiError.badRequest(
          `${menuItem.itemName} has only ${availableQuantity} left`,
        );
      }

      // Retry logic for concurrent booking race conditions
      let updated = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        updated = await MenuItem.findOneAndUpdate(
          {
            _id: menuItemId,
            isAvailable: true,
            availableQuantity: { $gte: quantity },
          },
          {
            $inc: { availableQuantity: -quantity },
          },
          { new: true },
        );

        if (updated) {
          break;
        }

        // Refresh item data and retry if stock was just bought by another user
        if (attempt < maxRetries) {
          const refreshedItem = await MenuItem.findById(menuItemId);
          if (refreshedItem && refreshedItem.availableQuantity >= quantity) {
            continue; // Retry
          }
          // If still not enough, fail with appropriate error
          const currentQty = refreshedItem?.availableQuantity || 0;
          throw ApiError.badRequest(
            `${menuItem.itemName} has only ${currentQty} left (was just purchased)`,
          );
        }
      }

      if (!updated) {
        throw ApiError.badRequest(`${menuItem.itemName} is out of stock`);
      }

      if ((updated.availableQuantity || 0) <= 0 && updated.isAvailable) {
        await MenuItem.findByIdAndUpdate(menuItemId, { isAvailable: false });
      }

      reserved.push({ menuItemId, quantity });
    }

    return reserved;
  } catch (error) {
    if (reserved.length > 0) {
      await Promise.all(
        reserved.map(({ menuItemId, quantity }) =>
          MenuItem.findByIdAndUpdate(menuItemId, {
            $inc: { availableQuantity: quantity },
            $set: { isAvailable: true },
          }),
        ),
      );
    }

    throw error;
  }
};

const restoreMenuStockFromItems = async (items = []) => {
  const grouped = new Map();

  for (const item of items) {
    const menuItemId = (item?.menuItem?._id || item?.menuItem || "").toString();
    if (!menuItemId) continue;

    const quantity = Math.max(0, Number(item.quantity) || 0);
    if (quantity === 0) continue;

    grouped.set(menuItemId, (grouped.get(menuItemId) || 0) + quantity);
  }

  if (grouped.size === 0) return;

  await Promise.all(
    Array.from(grouped.entries()).map(([menuItemId, quantity]) =>
      MenuItem.findByIdAndUpdate(menuItemId, {
        $inc: { availableQuantity: quantity },
        $set: { isAvailable: true },
      }),
    ),
  );
};

/**
 * Get user's bookings
 */
const getUserBookings = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);

  const filter = { user: userId };

  if (query.status) {
    filter.status = query.status;
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("slot")
      .populate("items.menuItem")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return paginateResponse(bookings, total, page, limit);
};

/**
 * Get all bookings (Admin/Staff)
 */
const getAllBookings = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.slotId) {
    filter.slot = query.slotId;
  }

  if (query.date) {
    const { start, end } = getDayBounds(query.date);
    const slotsForDate = await Slot.find({
      date: { $gte: start, $lte: end },
    }).select("_id");
    const slotIds = slotsForDate.map((slot) => slot._id.toString());

    if (filter.slot && !slotIds.includes(filter.slot.toString())) {
      return paginateResponse([], 0, page, limit);
    }

    filter.slot = {
      $in: slotIds,
    };
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("user", "fullName email")
      .populate("slot")
      .populate("items.menuItem")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return paginateResponse(bookings, total, page, limit);
};

/**
 * Get booking by ID
 */
const getBookingById = async (id) => {
  const booking = await Booking.findById(id)
    .populate("user", "fullName email")
    .populate("slot")
    .populate("items.menuItem");

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  return booking;
};

/**
 * Get booking by token number
 */
const getBookingByToken = async (tokenNumber) => {
  const booking = await Booking.findOne({ tokenNumber })
    .populate("user", "fullName email")
    .populate("slot")
    .populate("items.menuItem");

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  const tokenExpiryMins = await getPolicyNumber(POLICY_KEYS.tokenExpiry, null);

  if (tokenExpiryMins && booking?.slot) {
    const slotEndTime = await getSlotEndTime(booking.slot);
    if (slotEndTime) {
      const expiryTime = new Date(
        slotEndTime.getTime() + tokenExpiryMins * 60000,
      );
      if (new Date() > expiryTime) {
        throw ApiError.badRequest("Token has expired");
      }
    }
  }

  return booking;
};

/**
 * Create new booking
 */
const createBooking = async (userId, data) => {
  // Check slot availability
  const slot = await Slot.findById(data.slotId);

  if (!slot) {
    throw ApiError.notFound("Slot not found");
  }

  if (slot.status === "Cancelled") {
    throw ApiError.badRequest("This slot has been cancelled");
  }

  if (slot.isDisabled) {
    throw ApiError.badRequest("This slot is currently disabled");
  }

  if (slot.booked >= slot.capacity) {
    throw ApiError.badRequest("This slot is fully booked");
  }

  // Priority Segment Check
  const user = await User.findById(userId);
  if (user && user.segment === "student") {
    // Fetch reserved counts
    const facultyReserved = await getPolicyNumber("FACULTY_RESERVED_SLOTS", 0);
    const guestReserved = await getPolicyNumber("GUEST_RESERVED_SLOTS", 0);
    const totalReserved = Math.max(0, facultyReserved + guestReserved);

    // Prevent policy misconfiguration from blocking all student bookings.
    // Keep at least 1 slot bookable by students until the slot is actually full.
    const effectiveReserved = Math.min(
      totalReserved,
      Math.max(0, slot.capacity - 1),
    );

    // Calculate effective capacity for students
    const studentCapacity = slot.capacity - effectiveReserved;

    if (slot.booked >= studentCapacity) {
      throw ApiError.badRequest(
        `Slot is full for student bookings. Student allocation: ${studentCapacity}/${slot.capacity}.`,
      );
    }
  }

  await ensureServiceOpen("online");

  ensureSameDayBooking(slot.date);

  const peakWindowMins = await getPolicyNumber(
    POLICY_KEYS.peakBookingWindow,
    null,
  );
  const slotDateTime = parseSlotDateTime(slot);
  if (slotDateTime && new Date() >= slotDateTime) {
    throw ApiError.badRequest("Cannot book a past time slot");
  }

  if (slotDateTime && peakWindowMins && peakWindowMins > 0) {
    const windowStart = new Date(
      slotDateTime.getTime() - peakWindowMins * 60000,
    );
    if (new Date() < windowStart) {
      throw ApiError.badRequest(
        `Bookings open ${peakWindowMins} minutes before slot time`,
      );
    }
  }

  const maxBookingsPerDay = await getPolicyNumber(
    POLICY_KEYS.maxBookingsPerDay,
    null,
  );
  if (maxBookingsPerDay && maxBookingsPerDay > 0) {
    const { start, end } = getDayBounds(new Date());
    const slotIds = await Slot.find({
      date: { $gte: start, $lte: end },
    }).select("_id");
    const todaySlotIds = slotIds.map((s) => s._id);
    const bookingsToday = await Booking.countDocuments({
      user: userId,
      slot: { $in: todaySlotIds },
      status: { $ne: "cancelled" },
    });

    if (bookingsToday >= maxBookingsPerDay) {
      throw ApiError.badRequest(
        `Max ${maxBookingsPerDay} bookings allowed per day`,
      );
    }
  }

  const noShowPenaltyDays = await getPolicyNumber(
    POLICY_KEYS.noShowPenalty,
    null,
  );
  if (noShowPenaltyDays && noShowPenaltyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - noShowPenaltyDays);

    // Enforce penalty based on missed slot date/time instead of cancelledAt.
    // Auto-release can mark old missed bookings later and update cancelledAt,
    // which would otherwise incorrectly block users.
    const recentSlotIds = await Slot.find({
      date: { $gte: cutoff },
    }).select("_id");

    const recentNoShow = await Booking.findOne({
      user: userId,
      status: "no_show",
      slot: { $in: recentSlotIds.map((s) => s._id) },
    }).select("_id");

    if (recentNoShow) {
      throw ApiError.forbidden(
        `Booking blocked for ${noShowPenaltyDays} days due to no-show`,
      );
    }
  }

  // Check for existing booking for same slot
  const existingBooking = await Booking.findOne({
    user: userId,
    slot: data.slotId,
    status: "confirmed",
  });

  if (existingBooking) {
    throw ApiError.conflict("You already have a booking for this slot");
  }

  const requestedItems = aggregateRequestedItems(data.items || []);
  if (requestedItems.length === 0) {
    throw ApiError.badRequest("At least one menu item is required");
  }

  const menuItemsById = await getMenuItemsByRequest(requestedItems);

  // Fetch menu items and calculate prices
  const bookingItems = [];
  let totalAmount = 0;

  for (const item of requestedItems) {
    const menuItem = menuItemsById.get(item.menuItemId);
    const quantity = item.quantity || 1;
    const itemTotal = menuItem.price * quantity;

    bookingItems.push({
      menuItem: menuItem._id,
      quantity,
      price: menuItem.price,
    });

    totalAmount += itemTotal;
  }

  let reservedStock = [];
  let booking = null;
  let slotIncremented = false;

  try {
    reservedStock = await reserveMenuStock(requestedItems, menuItemsById);

    booking = await Booking.create({
      user: userId,
      slot: data.slotId,
      items: bookingItems,
      totalAmount,
      notes: data.notes,
    });

    await slotService.incrementBooking(data.slotId);
    slotIncremented = true;

    await booking.populate([{ path: "slot" }, { path: "items.menuItem" }]);

    try {
      await notificationService.createNotification({
        userId,
        title: "Booking Confirmed!",
        message: `Your booking (Token: ${booking.tokenNumber}) for ${slot.time} is confirmed.`,
        type: "order",
        link: `/student/booking?id=${booking._id}`,
      });
    } catch (notificationError) {
      // Booking creation should not fail if notification fails.
      console.error(
        "Failed to send booking confirmation notification:",
        notificationError,
      );
    }

    return booking;
  } catch (error) {
    if (booking?._id) {
      await Booking.findByIdAndDelete(booking._id).catch(() => null);
    }

    if (slotIncremented) {
      await slotService.decrementBooking(data.slotId).catch(() => null);
    }

    if (reservedStock.length > 0) {
      await restoreMenuStockFromItems(
        reservedStock.map((item) => ({
          menuItem: item.menuItemId,
          quantity: item.quantity,
        })),
      );
    }

    throw error;
  }
};

/**
 * Cancel booking
 */
const cancelBooking = async (id, userId, reason) => {
  const booking = await Booking.findById(id);

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  // Check ownership (unless admin)
  if (booking.user.toString() !== userId.toString()) {
    throw ApiError.forbidden("Not authorized to cancel this booking");
  }

  if (booking.status !== "confirmed") {
    throw ApiError.badRequest("Booking cannot be cancelled");
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason;
  await booking.save();

  // Decrement slot booking count
  await slotService.decrementBooking(booking.slot);

  // Return reserved stock back to menu items
  await restoreMenuStockFromItems(booking.items);

  // Send cancellation notification
  try {
    await notificationService.createNotification({
      userId: booking.user,
      title: "Booking Cancelled",
      message: `Your booking (Token: ${booking.tokenNumber}) has been cancelled.`,
      type: "alert",
    });
  } catch (notificationError) {
    console.error(
      "Failed to send cancellation notification:",
      notificationError,
    );
  }

  return booking;
};

/**
 * Complete booking (Staff)
 */
const completeBooking = async (id, staffUserId, cashCollected = 0) => {
  const booking = await Booking.findById(id).populate("slot");

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.status !== "confirmed") {
    throw ApiError.badRequest("Booking cannot be completed");
  }

  if (booking?.slot) {
    const tokenExpiryMins = await getPolicyNumber(
      POLICY_KEYS.tokenExpiry,
      null,
    );
    if (tokenExpiryMins) {
      const slotEndTime = await getSlotEndTime(booking.slot);
      if (slotEndTime) {
        const expiryTime = new Date(
          slotEndTime.getTime() + tokenExpiryMins * 60000,
        );
        if (new Date() > expiryTime) {
          throw ApiError.badRequest("Token has expired");
        }
      }
    }
  }

  booking.status = "completed";
  booking.completedAt = new Date();
  await booking.save();

  if (cashCollected > 0) {
    await financialService.recordCashSale(
      cashCollected,
      `Cash collected for token ${booking.tokenNumber}`,
      booking.slot ? booking.slot.canteenId : null,
      staffUserId,
    );
  }

  // Send completion notification
  await notificationService.createNotification({
    userId: booking.user,
    title: "Order Ready!",
    message: `Your order ${booking.tokenNumber} is ready for pickup!`,
    type: "order",
    isUrgent: true,
  });

  return booking;
};

/**
 * Get booking statistics
 */
const getBookingStats = async (date, canteenId) => {
  const { start, end } = getDayBounds(date || new Date());

  // Build match stage - lookup slot if canteenId filter is provided
  const pipeline = [];

  // Match by date
  pipeline.push({
    $match: {
      createdAt: { $gte: start, $lte: end },
    },
  });

  // If canteenId is provided, lookup slot and filter by canteenId
  if (canteenId) {
    const canteenFilter = mongoose.Types.ObjectId.isValid(String(canteenId))
      ? {
          $or: [
            { "slotData.canteenId": String(canteenId) },
            {
              "slotData.canteenId": new mongoose.Types.ObjectId(
                String(canteenId),
              ),
            },
          ],
        }
      : { "slotData.canteenId": String(canteenId) };

    pipeline.push(
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
        $match: canteenFilter,
      },
    );
  }

  // Group by status
  pipeline.push({
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      totalAmount: { $sum: "$totalAmount" },
    },
  });

  const stats = await Booking.aggregate(pipeline);

  const totalBookings = stats.reduce((acc, s) => acc + s.count, 0);
  const totalRevenue = stats
    .filter((s) => s._id === "completed")
    .reduce((acc, s) => acc + s.totalAmount, 0);

  // Extract individual status counts for frontend compatibility
  const confirmed = stats.find((s) => s._id === "confirmed")?.count || 0;
  const completed = stats.find((s) => s._id === "completed")?.count || 0;
  const cancelled = stats.find((s) => s._id === "cancelled")?.count || 0;
  const expired =
    stats.find((s) => s._id === "expired" || s._id === "no_show")?.count || 0;

  return {
    date: start.toISOString().split("T")[0],
    total: totalBookings,
    totalBookings,
    totalRevenue,
    confirmed,
    completed,
    cancelled,
    expired,
    byStatus: stats,
  };
};

/**
 * Create walk-in booking (Staff only - no user required)
 */
const createWalkinBooking = async (data, staffUserId) => {
  // Check slot availability
  const slot = await Slot.findById(data.slotId);

  if (!slot) {
    throw ApiError.notFound("Slot not found");
  }

  if (slot.status === "Cancelled") {
    throw ApiError.badRequest("This slot has been cancelled");
  }

  if (slot.booked >= slot.capacity) {
    throw ApiError.badRequest("This slot is fully booked");
  }

  await ensureServiceOpen("walkin");

  ensureSameDayBooking(slot.date);

  if (staffUserId) {
    const staffUser = await User.findById(staffUserId);
    if (staffUser && !["admin", "manager"].includes(staffUser.role)) {
      if (
        slot.canteenId &&
        slot.canteenId.toString() !== staffUser.canteenId?.toString()
      ) {
        throw ApiError.forbidden(
          "Not authorized: Cannot create walk-in for a different canteen.",
        );
      }
    }
  }

  const slotDateTime = parseSlotDateTime(slot);
  if (slotDateTime && new Date() >= slotDateTime) {
    throw ApiError.badRequest("Cannot book a past time slot");
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const requestedItems = aggregateRequestedItems(rawItems);
  const menuItemsById =
    requestedItems.length > 0
      ? await getMenuItemsByRequest(requestedItems)
      : new Map();

  // Fetch menu items and calculate prices
  const bookingItems = [];
  let totalAmount = 0;

  for (const item of rawItems) {
    const menuItemId = (item.menuItemId || item.menuItem || "").toString();
    const menuItem = menuItemsById.get(menuItemId);

    if (!menuItem) {
      throw ApiError.badRequest(`Menu item not found: ${menuItemId}`);
    }

    const quantity = item.quantity || 1;
    // Apply portion size discount (Small = 80%)
    const portionMultiplier = item.portionSize === "Small" ? 0.8 : 1;
    const price = Math.round(menuItem.price * portionMultiplier);
    const itemTotal = price * quantity;

    bookingItems.push({
      menuItem: menuItem._id,
      quantity,
      price,
      portionSize: item.portionSize || "Regular",
    });

    totalAmount += itemTotal;
  }

  let reservedStock = [];
  let booking = null;
  let slotIncremented = false;

  try {
    if (requestedItems.length > 0) {
      reservedStock = await reserveMenuStock(requestedItems, menuItemsById);
    }

    // Create walk-in booking (no user association)
    booking = await Booking.create({
      slot: data.slotId,
      items: bookingItems,
      totalAmount,
      notes: data.notes,
      isWalkin: true,
      guestName: data.guestName || "Walk-in Guest",
    });

    // Increment slot booking count
    await slotService.incrementBooking(data.slotId);
    slotIncremented = true;

    if (data.cashCollected > 0) {
      await financialService.recordCashSale(
        data.cashCollected,
        `Cash collected for walk-in token ${booking.tokenNumber}`,
        slot.canteenId,
        staffUserId,
      );
    }

    // Populate and return
    await booking.populate([{ path: "slot" }, { path: "items.menuItem" }]);

    return booking;
  } catch (error) {
    if (booking?._id) {
      await Booking.findByIdAndDelete(booking._id).catch(() => null);
    }

    if (slotIncremented) {
      await slotService.decrementBooking(data.slotId).catch(() => null);
    }

    if (reservedStock.length > 0) {
      await restoreMenuStockFromItems(
        reservedStock.map((item) => ({
          menuItem: item.menuItemId,
          quantity: item.quantity,
        })),
      );
    }

    throw error;
  }
};

/**
 * Mark booking as no-show
 */
const markNoShow = async (id) => {
  const booking = await Booking.findById(id);

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.status !== "confirmed") {
    throw ApiError.badRequest(
      "Only confirmed bookings can be marked as no-show",
    );
  }

  booking.status = "no_show";
  booking.cancelledAt = new Date();
  booking.cancellationReason = "No-show - auto marked";
  await booking.save();

  // Release the slot
  await slotService.decrementBooking(booking.slot);

  // Send no-show notification
  await notificationService.createNotification({
    userId: booking.user,
    title: "Booking Missed",
    message: `You missed your booking (Token: ${booking.tokenNumber}). Please arrive on time next time.`,
    type: "alert",
  });

  return booking;
};

/**
 * Release no-show slots after grace period (Cron job)
 * Grace period is 15 minutes after slot time
 */
const releaseNoShowSlots = async () => {
  const now = new Date();
  const gracePeriodMinutes = await getPolicyNumber(POLICY_KEYS.noShowGrace, 15);

  // Find slots that ended grace period ago
  const cutoffTime = new Date(now.getTime() - gracePeriodMinutes * 60 * 1000);

  // Get today's slots that have passed
  const { start, end } = getDayBounds(now);

  const expiredSlots = await Slot.find({
    date: { $gte: start, $lte: end },
    status: { $in: ["Open", "FastFilling", "Full"] },
  });

  let releasedCount = 0;

  for (const slot of expiredSlots) {
    // Parse slot time and compare with cutoff
    const slotEndTime = await getSlotEndTime(slot);
    if (!slotEndTime) continue;

    const slotCutoff = new Date(
      slotEndTime.getTime() + gracePeriodMinutes * 60 * 1000,
    );

    if (now >= slotCutoff) {
      // Mark all confirmed bookings for this slot as no-show
      const confirmedBookings = await Booking.find({
        slot: slot._id,
        status: "confirmed",
      }).select("_id");

      if (confirmedBookings.length === 0) continue;

      const noShowBookings = await Booking.updateMany(
        { _id: { $in: confirmedBookings.map((b) => b._id) } },
        {
          $set: {
            status: "no_show",
            cancelledAt: now,
            cancellationReason: "Auto-released after grace period",
          },
        },
      );

      const released = noShowBookings.modifiedCount || 0;
      releasedCount += released;

      if (released > 0) {
        await slotService.decrementBookingBy(slot._id, released);
      }
    }
  }

  return { releasedCount, processedAt: now };
};

/**
 * Get scan history (completed bookings) for staff
 */
const getScanHistory = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { status: "completed" };

  if (query.date) {
    const { start, end } = getDayBounds(query.date);
    filter.completedAt = { $gte: start, $lte: end };
  }

  if (query.canteenId) {
    const slots = await Slot.find({ canteenId: query.canteenId }).select("_id");
    const slotIds = slots.map((slot) => slot._id);
    filter.slot = { $in: slotIds };
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("user", "fullName email")
      .populate("slot")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return paginateResponse(bookings, total, page, limit);
};

/**
 * Get real-time queue info for a slot (optionally for a specific user)
 */
const getQueueInfo = async (slotId, userId) => {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    throw ApiError.notFound("Slot not found");
  }

  // All confirmed (waiting) bookings for this slot, ordered by creation time
  const confirmedBookings = await Booking.find({
    slot: slotId,
    status: "confirmed",
  })
    .sort({ createdAt: 1 })
    .select("_id user createdAt");

  const totalInQueue = confirmedBookings.length;

  // Determine the user's position (1-based) in queue
  let position = 0;
  if (userId) {
    const idx = confirmedBookings.findIndex(
      (b) => b.user && b.user.toString() === userId.toString(),
    );
    position = idx >= 0 ? idx + 1 : 0;
  }
  const peopleAhead = Math.max(0, position - 1);

  // Compute average service time from today's completed bookings for this slot
  const completedBookings = await Booking.find({
    slot: slotId,
    status: "completed",
    completedAt: { $exists: true },
  }).select("createdAt completedAt");

  let avgServiceTimeMins = 2.5; // default fallback
  if (completedBookings.length > 0) {
    const totalMins = completedBookings.reduce((sum, b) => {
      const diff =
        (new Date(b.completedAt).getTime() - new Date(b.createdAt).getTime()) /
        60000;
      return sum + Math.max(0, diff);
    }, 0);
    avgServiceTimeMins = totalMins / completedBookings.length;
    // Clamp to reasonable range
    avgServiceTimeMins = Math.max(0.5, Math.min(avgServiceTimeMins, 30));
  }

  const estimatedWaitMins = Math.ceil(peopleAhead * avgServiceTimeMins);

  return {
    slotId: slot._id,
    totalInQueue,
    completed: completedBookings.length,
    position,
    peopleAhead,
    avgServiceTimeMins: Math.round(avgServiceTimeMins * 10) / 10,
    estimatedWaitMins,
  };
};

/**
 * Reschedule booking to a new slot (up to 30 minutes before start time)
 */
const rescheduleBooking = async (bookingId, newSlotId, userId) => {
  const booking = await Booking.findById(bookingId).populate("slot");

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.user.toString() !== userId.toString()) {
    throw ApiError.forbidden("Not authorized to reschedule this booking");
  }

  if (booking.status !== "confirmed") {
    throw ApiError.badRequest("Only confirmed bookings can be rescheduled");
  }

  // 30-minute cancellation enforcement
  const slotDateTime = parseSlotDateTime(booking.slot);
  if (slotDateTime) {
    const cutoffTime = new Date(slotDateTime.getTime() - 30 * 60000);
    if (new Date() > cutoffTime) {
      throw ApiError.badRequest(
        "Cannot reschedule within 30 minutes of slot start time",
      );
    }
  }

  // Check new slot availability
  const newSlot = await Slot.findById(newSlotId);
  if (!newSlot) {
    throw ApiError.notFound("New slot not found");
  }
  if (newSlot.status === "Cancelled") {
    throw ApiError.badRequest("Target slot has been cancelled");
  }
  if (newSlot.booked >= newSlot.capacity) {
    throw ApiError.badRequest("Target slot is fully booked");
  }

  ensureSameDayBooking(newSlot.date);

  // Release old slot
  await slotService.decrementBooking(booking.slot._id || booking.slot);

  // Book new slot
  booking.slot = newSlotId;
  booking.allocationReason = "Rescheduled by student";
  await booking.save();
  await slotService.incrementBooking(newSlotId);

  await booking.populate([{ path: "slot" }, { path: "items.menuItem" }]);

  await notificationService.createNotification({
    userId: booking.user,
    title: "Booking Rescheduled",
    message: `Your booking (Token: ${booking.tokenNumber}) has been rescheduled to ${newSlot.time}.`,
    type: "order",
  });

  return booking;
};

/**
 * Replace booking items by staff/counter while optionally enforcing same total
 */
const replaceBookingItems = async (bookingId, data) => {
  const booking = await Booking.findById(bookingId).populate("items.menuItem");

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.status !== "confirmed") {
    throw ApiError.badRequest("Only confirmed bookings can be edited");
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const requestedItems = aggregateRequestedItems(rawItems);
  if (requestedItems.length === 0) {
    throw ApiError.badRequest("At least one menu item is required");
  }

  const menuItemsById = await getMenuItemsByRequest(requestedItems);

  const bookingItems = [];
  let newTotalAmount = 0;

  for (const item of rawItems) {
    const menuItemId = (item.menuItemId || item.menuItem || "").toString();
    const menuItem = menuItemsById.get(menuItemId);
    if (!menuItem) {
      throw ApiError.badRequest(`Menu item not found: ${menuItemId}`);
    }

    const quantity = Math.max(1, Number(item.quantity) || 1);
    const portionSize = item.portionSize === "Small" ? "Small" : "Regular";
    const portionMultiplier = portionSize === "Small" ? 0.8 : 1;
    const price = Math.round(menuItem.price * portionMultiplier);

    bookingItems.push({
      menuItem: menuItem._id,
      quantity,
      price,
      portionSize,
    });

    newTotalAmount += price * quantity;
  }

  const oldTotalAmount = Number(booking.totalAmount || 0);
  const enforceSameTotal = data.enforceSameTotal !== false;
  if (enforceSameTotal && newTotalAmount !== oldTotalAmount) {
    throw ApiError.badRequest(
      `Replacement must keep total at ₹${oldTotalAmount}. Current selection totals ₹${newTotalAmount}.`,
    );
  }

  let reservedStock = [];

  try {
    reservedStock = await reserveMenuStock(requestedItems, menuItemsById);

    const oldItems = booking.items || [];

    booking.items = bookingItems;
    booking.totalAmount = newTotalAmount;
    booking.allocationReason = "Updated by staff at counter";
    await booking.save();

    await restoreMenuStockFromItems(oldItems);

    await booking.populate([
      { path: "user", select: "fullName email" },
      { path: "slot" },
      { path: "items.menuItem" },
    ]);

    return booking;
  } catch (error) {
    if (reservedStock.length > 0) {
      await restoreMenuStockFromItems(
        reservedStock.map((item) => ({
          menuItem: item.menuItemId,
          quantity: item.quantity,
        })),
      );
    }

    throw error;
  }
};

/**
 * Get token invalidation details with user-friendly reason
 */
const getTokenStatus = async (tokenNumber) => {
  const booking = await Booking.findOne({ tokenNumber })
    .populate("user", "fullName email")
    .populate("slot")
    .populate("items.menuItem");

  if (!booking) {
    throw ApiError.notFound("Token not found");
  }

  const REASON_LABELS = {
    confirmed: {
      status: "Active",
      message: "Your token is active and valid.",
      icon: "✅",
    },
    completed: {
      status: "Completed",
      message: "Your meal has been served.",
      icon: "🍽️",
    },
    cancelled: {
      status: "Cancelled",
      message: booking.cancellationReason || "This booking was cancelled.",
      icon: "❌",
    },
    no_show: {
      status: "Missed",
      message:
        "You did not arrive within the grace period. The slot was released for others.",
      icon: "⏰",
    },
  };

  const statusInfo = REASON_LABELS[booking.status] || {
    status: booking.status,
    message: "Unknown status",
    icon: "❓",
  };

  // Check token expiry
  let isExpired = false;
  if (booking.status === "confirmed" && booking.slot) {
    const tokenExpiryMins = await getPolicyNumber(
      POLICY_KEYS.tokenExpiry,
      null,
    );
    if (tokenExpiryMins) {
      const slotEndTime = await getSlotEndTime(booking.slot);
      if (slotEndTime) {
        const expiryTime = new Date(
          slotEndTime.getTime() + tokenExpiryMins * 60000,
        );
        if (new Date() > expiryTime) {
          isExpired = true;
          statusInfo.status = "Expired";
          statusInfo.message =
            "Your token has expired because the slot time has passed.";
          statusInfo.icon = "⌛";
        }
      }
    }
  }

  return {
    tokenNumber: booking.tokenNumber,
    booking,
    ...statusInfo,
    isExpired,
    allocationReason: booking.allocationReason,
  };
};

/**
 * Generate secure QR token for a booking
 */
const generateBookingQRToken = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId)
    .populate("user", "name email")
    .populate("slot", "time date")
    .populate("items.menuItem", "itemName name price");

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  // Verify ownership (user can only generate QR for their own bookings)
  if (booking.user && booking.user._id.toString() !== userId.toString()) {
    throw ApiError.forbidden(
      "You can only generate QR tokens for your own bookings",
    );
  }

  // Don't allow QR generation for cancelled/completed bookings
  if (booking.status === "cancelled" || booking.status === "no_show") {
    throw ApiError.badRequest(
      "Cannot generate QR token for cancelled or no-show bookings",
    );
  }

  // Calculate expiry time for token
  const tokenExpiryMins = await getPolicyNumber(POLICY_KEYS.tokenExpiry, null);
  let expiryAt = null;
  if (tokenExpiryMins && booking.slot) {
    const slotEndTime = await getSlotEndTime(booking.slot);
    if (slotEndTime) {
      expiryAt = new Date(slotEndTime.getTime() + tokenExpiryMins * 60000);
    }
  }

  // Get canteen name
  const canteenName = booking.slot?.canteen?.name || "Smart Cafe";

  // Convert slot to object with virtuals to access startTime and endTime
  const slotData = booking.slot
    ? booking.slot.toObject({ virtuals: true })
    : null;

  // Prepare booking data for QR token
  const qrTokenUtil = require("../utils/qrToken");
  const qrToken = qrTokenUtil.generateQRToken({
    bookingId: booking._id.toString(),
    tokenNumber: booking.tokenNumber,
    userId: booking.user?._id?.toString() || null,
    userName: booking.user?.name || booking.guestName || "Guest",
    userEmail: booking.user?.email || null,
    slotTime:
      slotData?.time ||
      `${slotData?.startTime || ""} - ${slotData?.endTime || ""}`,
    slotDate: slotData?.date?.toISOString() || new Date().toISOString(),
    slotStartTime: slotData?.startTime || null,
    slotEndTime: slotData?.endTime || null,
    totalAmount: booking.totalAmount,
    items: booking.items.map((item) => ({
      name: item.menuItem?.itemName || item.menuItem?.name || "Item",
      quantity: item.quantity,
      price: item.price,
      portionSize: item.portionSize || "Regular",
    })),
    status: booking.status,
    expiryAt: expiryAt?.toISOString() || null,
    canteenName,
    createdAt: booking.createdAt.toISOString(),
  });

  return qrToken;
};

/**
 * Verify and decode QR token
 */
const verifyBookingQRToken = async (qrToken, staffUserId) => {
  const qrTokenUtil = require("../utils/qrToken");

  // Verify JWT signature
  let decoded;
  try {
    decoded = qrTokenUtil.verifyQRToken(qrToken);
  } catch (error) {
    throw ApiError.badRequest(error.message);
  }

  // Validate token data
  const validation = qrTokenUtil.validateQRToken(decoded);

  // Fetch current booking status from database
  let currentBooking = null;
  if (decoded.bookingId) {
    try {
      currentBooking = await Booking.findById(decoded.bookingId)
        .populate("user", "name email")
        .populate("slot", "time date startTime endTime");
    } catch (error) {
      // Booking not found - validation will catch this
    }
  }

  // If booking exists, check current status
  if (currentBooking) {
    if (staffUserId) {
      const staffUser = await User.findById(staffUserId);
      if (staffUser && !["admin", "manager"].includes(staffUser.role)) {
        if (
          currentBooking.slot &&
          currentBooking.slot.canteenId &&
          currentBooking.slot.canteenId.toString() !==
            staffUser.canteenId?.toString()
        ) {
          throw ApiError.forbidden(
            "Not authorized: Booking belongs to a different canteen.",
          );
        }
      }
    }
    // Update validation based on current booking status
    if (currentBooking.status === "completed") {
      validation.errors.push("This booking has already been completed");
      validation.isValid = false;
    } else if (currentBooking.status === "cancelled") {
      validation.errors.push("This booking has been cancelled");
      validation.isValid = false;
    } else if (currentBooking.status === "no_show") {
      validation.errors.push("This booking was marked as no-show");
      validation.isValid = false;
    }
  }

  return {
    decoded,
    validation,
    currentBooking: currentBooking
      ? {
          id: currentBooking._id,
          tokenNumber: currentBooking.tokenNumber,
          status: currentBooking.status,
          totalAmount: currentBooking.totalAmount,
          user: currentBooking.user,
          slot: currentBooking.slot,
        }
      : null,
  };
};

module.exports = {
  getUserBookings,
  getAllBookings,
  getBookingById,
  getBookingByToken,
  createBooking,
  createWalkinBooking,
  cancelBooking,
  completeBooking,
  markNoShow,
  releaseNoShowSlots,
  getBookingStats,
  getScanHistory,
  getQueueInfo,
  rescheduleBooking,
  replaceBookingItems,
  getTokenStatus,
  generateBookingQRToken,
  verifyBookingQRToken,
};
