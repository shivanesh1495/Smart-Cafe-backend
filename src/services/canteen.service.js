const { Canteen, Slot, Booking } = require("../models");
const { getDayBounds } = require("../utils/helpers");
const ApiError = require("../utils/ApiError");
const { STATUSES, CROWD_LEVELS, ECO_SCORES } = require("../models/Canteen");

/**
 * Get canteen configuration — enum values, field definitions for dynamic forms/tables
 */
const getCanteenConfig = () => {
  return {
    statuses: STATUSES,
    crowdLevels: CROWD_LEVELS,
    ecoScores: ECO_SCORES,
    colorOptions: [
      { value: "bg-orange-100", label: "Orange" },
      { value: "bg-green-100", label: "Green" },
      { value: "bg-blue-100", label: "Blue" },
      { value: "bg-purple-100", label: "Purple" },
      { value: "bg-pink-100", label: "Pink" },
      { value: "bg-yellow-100", label: "Yellow" },
    ],
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        maxLength: 100,
      },
      {
        key: "location",
        label: "Location",
        type: "text",
        required: false,
        maxLength: 200,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        required: false,
        maxLength: 500,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: false,
        options: STATUSES,
        default: "Open",
      },
      {
        key: "crowd",
        label: "Crowd Level",
        type: "select",
        required: false,
        options: CROWD_LEVELS,
        default: "Low",
        autoComputed: true,
      },
      {
        key: "capacity",
        label: "Capacity",
        type: "number",
        required: true,
        min: 1,
      },
      {
        key: "occupancy",
        label: "Current Occupancy",
        type: "number",
        required: false,
        min: 0,
        default: 0,
        autoComputed: true,
      },
      {
        key: "ecoScore",
        label: "Eco Score",
        type: "select",
        required: false,
        options: ECO_SCORES,
        default: "B",
      },
      {
        key: "imageColor",
        label: "Color Theme",
        type: "color-select",
        required: false,
        default: "bg-orange-100",
      },
      {
        key: "operatingHours.open",
        label: "Opening Time",
        type: "time",
        required: false,
        default: "08:00",
      },
      {
        key: "operatingHours.close",
        label: "Closing Time",
        type: "time",
        required: false,
        default: "20:00",
      },
    ],
    tableColumns: [
      { key: "name", label: "Canteen", type: "avatar-text" },
      { key: "location", label: "Location", type: "icon-text", icon: "MapPin" },
      { key: "status", label: "Status", type: "badge" },
      { key: "crowd", label: "Crowd", type: "crowd-badge" },
      { key: "capacity", label: "Capacity", type: "occupancy" },
      { key: "ecoScore", label: "Eco Score", type: "eco-score" },
      { key: "isActive", label: "Active", type: "toggle" },
    ],
  };
};

/**
 * Compute real-time occupancy for a canteen from active bookings in today's slots.
 * Updates the canteen's occupancy & crowd fields in-place (saved to DB).
 */
const refreshOccupancy = async (canteen) => {
  try {
    // Skip auto-refresh if occupancy was manually set by admin/management
    if (canteen.manualOccupancyOverride) {
      return canteen;
    }

    const { start, end } = getDayBounds(new Date());

    // Find today's active slots for this canteen
    const slots = await Slot.find({
      canteenId: canteen.id || canteen._id.toString(),
      date: { $gte: start, $lte: end },
      status: { $ne: "Cancelled" },
    }).select("_id");

    const slotIds = slots.map((s) => s._id);

    // Count confirmed (not yet served) bookings — these people are in the canteen queue
    const activeBookings = slotIds.length
      ? await Booking.countDocuments({
          slot: { $in: slotIds },
          status: "confirmed",
        })
      : 0;

    canteen.occupancy = Math.min(activeBookings, canteen.capacity);

    // Auto-calculate crowd level
    const pct = (canteen.occupancy / canteen.capacity) * 100;
    if (pct < 40) canteen.crowd = "Low";
    else if (pct < 75) canteen.crowd = "Medium";
    else canteen.crowd = "High";

    await canteen.save();
  } catch (err) {
    // Don't let occupancy refresh failure break the entire canteen list
    console.error(
      `refreshOccupancy failed for canteen ${canteen.name}:`,
      err.message,
    );
  }
  return canteen;
};

/**
 * Get all canteens with optional filtering
 */
const getCanteens = async (query = {}) => {
  const { status, isActive, search } = query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === "true" || isActive === true;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const canteens = await Canteen.find(filter).sort({ name: 1 });

  // Refresh real-time occupancy/crowd for each canteen
  await Promise.all(canteens.map((c) => refreshOccupancy(c)));

  return { canteens };
};

/**
 * Get canteen by ID
 */
const getCanteenById = async (canteenId) => {
  const canteen = await Canteen.findById(canteenId);

  if (!canteen) {
    throw new ApiError(404, "Canteen not found");
  }

  // Refresh real-time occupancy/crowd
  await refreshOccupancy(canteen);

  return canteen;
};

/**
 * Create a new canteen
 */
const createCanteen = async (data) => {
  const canteen = await Canteen.create(data);
  return canteen;
};

/**
 * Update canteen
 */
const updateCanteen = async (canteenId, data) => {
  // If occupancy is being manually set, enable the override flag
  if (data.occupancy !== undefined) {
    data.manualOccupancyOverride = true;
  }

  const canteen = await Canteen.findByIdAndUpdate(
    canteenId,
    { $set: data },
    { new: true, runValidators: true },
  );

  if (!canteen) {
    throw new ApiError(404, "Canteen not found");
  }

  return canteen;
};

/**
 * Delete canteen
 */
const deleteCanteen = async (canteenId) => {
  const canteen = await Canteen.findByIdAndDelete(canteenId);

  if (!canteen) {
    throw new ApiError(404, "Canteen not found");
  }

  return canteen;
};

/**
 * Toggle canteen active status
 */
const toggleCanteenStatus = async (canteenId) => {
  const canteen = await Canteen.findById(canteenId);

  if (!canteen) {
    throw new ApiError(404, "Canteen not found");
  }

  canteen.isActive = !canteen.isActive;
  await canteen.save();

  return canteen;
};

/**
 * Update canteen occupancy
 */
const updateOccupancy = async (canteenId, occupancy) => {
  const canteen = await Canteen.findById(canteenId);

  if (!canteen) {
    throw new ApiError(404, "Canteen not found");
  }

  canteen.occupancy = Math.max(0, Math.min(occupancy, canteen.capacity));
  canteen.manualOccupancyOverride = true;

  // Auto-update crowd level based on occupancy percentage
  const occupancyPercent = (canteen.occupancy / canteen.capacity) * 100;
  if (occupancyPercent < 40) {
    canteen.crowd = "Low";
  } else if (occupancyPercent < 75) {
    canteen.crowd = "Medium";
  } else {
    canteen.crowd = "High";
  }

  await canteen.save();
  return canteen;
};

/**
 * Reset occupancy override — clears manual flag so auto-refresh resumes
 */
const resetOccupancyOverride = async (canteenId) => {
  const canteen = await Canteen.findById(canteenId);

  if (!canteen) {
    throw new ApiError(404, "Canteen not found");
  }

  canteen.manualOccupancyOverride = false;
  await canteen.save();

  // Immediately refresh from bookings
  await refreshOccupancy(canteen);

  return canteen;
};

module.exports = {
  getCanteenConfig,
  getCanteens,
  getCanteenById,
  createCanteen,
  updateCanteen,
  deleteCanteen,
  toggleCanteenStatus,
  updateOccupancy,
  resetOccupancyOverride,
};
