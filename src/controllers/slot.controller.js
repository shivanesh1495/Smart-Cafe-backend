const { slotService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");

/**
 * Get all slots
 * GET /api/slots
 */
const getSlots = catchAsync(async (req, res) => {
  const result = await slotService.getSlots(req.query);

  ApiResponse.ok(res, "Slots retrieved", result);
});

/**
 * Get slot by ID
 * GET /api/slots/:id
 */
const getSlotById = catchAsync(async (req, res) => {
  const slot = await slotService.getSlotById(req.params.id);

  ApiResponse.ok(res, "Slot retrieved", slot);
});

/**
 * Create new slot
 * POST /api/slots
 */
const createSlot = catchAsync(async (req, res) => {
  const slot = await slotService.createSlot(req.body);

  ApiResponse.created(res, "Slot created", slot);
});

/**
 * Update slot
 * PATCH /api/slots/:id
 */
const updateSlot = catchAsync(async (req, res) => {
  const slot = await slotService.updateSlot(req.params.id, req.body);

  ApiResponse.ok(res, "Slot updated", slot);
});

/**
 * Update slot capacity
 * PATCH /api/slots/:id/capacity
 */
const updateCapacity = catchAsync(async (req, res) => {
  const slot = await slotService.updateCapacity(
    req.params.id,
    req.body.capacity,
  );

  ApiResponse.ok(res, "Capacity updated", slot);
});

/**
 * Cancel slot
 * POST /api/slots/:id/cancel
 */
const cancelSlot = catchAsync(async (req, res) => {
  const slot = await slotService.cancelSlot(req.params.id);

  ApiResponse.ok(res, "Slot cancelled", slot);
});

/**
 * Delete slot
 * DELETE /api/slots/:id
 */
const deleteSlot = catchAsync(async (req, res) => {
  await slotService.deleteSlot(req.params.id);

  ApiResponse.ok(res, "Slot deleted");
});

/**
 * Disable system slot
 * POST /api/slots/:id/disable
 */
const disableSlot = catchAsync(async (req, res) => {
  const slot = await slotService.disableSlot(req.params.id);

  ApiResponse.ok(res, "System slot disabled", slot);
});

/**
 * Enable system slot
 * POST /api/slots/:id/enable
 */
const enableSlot = catchAsync(async (req, res) => {
  const slot = await slotService.enableSlot(req.params.id);

  ApiResponse.ok(res, "System slot enabled", slot);
});

/**
 * Get today's slots
 * GET /api/slots/today
 */
const getTodaySlots = catchAsync(async (req, res) => {
  const slots = await slotService.getTodaySlots(req.query.canteenId);

  ApiResponse.ok(res, "Today's slots retrieved", slots);
});

module.exports = {
  getSlots,
  getSlotById,
  createSlot,
  updateSlot,
  updateCapacity,
  cancelSlot,
  deleteSlot,
  disableSlot,
  enableSlot,
  getTodaySlots,
};
