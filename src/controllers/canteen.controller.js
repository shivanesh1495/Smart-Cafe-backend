const { canteenService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");

/**
 * Get canteen configuration (enum values, field definitions)
 * GET /api/canteens/config
 */
const getCanteenConfig = catchAsync(async (req, res) => {
  const config = canteenService.getCanteenConfig();
  ApiResponse.ok(res, "Canteen configuration retrieved", config);
});

/**
 * Get all canteens
 * GET /api/canteens
 */
const getCanteens = catchAsync(async (req, res) => {
  const result = await canteenService.getCanteens(req.query);

  ApiResponse.ok(res, "Canteens retrieved", result);
});

/**
 * Get canteen by ID
 * GET /api/canteens/:id
 */
const getCanteenById = catchAsync(async (req, res) => {
  const canteen = await canteenService.getCanteenById(req.params.id);

  ApiResponse.ok(res, "Canteen retrieved", canteen);
});

/**
 * Create new canteen
 * POST /api/canteens
 */
const createCanteen = catchAsync(async (req, res) => {
  const canteen = await canteenService.createCanteen(req.body);

  ApiResponse.created(res, "Canteen created", canteen);
});

/**
 * Update canteen
 * PATCH /api/canteens/:id
 */
const updateCanteen = catchAsync(async (req, res) => {
  const canteen = await canteenService.updateCanteen(req.params.id, req.body);

  ApiResponse.ok(res, "Canteen updated", canteen);
});

/**
 * Delete canteen
 * DELETE /api/canteens/:id
 */
const deleteCanteen = catchAsync(async (req, res) => {
  await canteenService.deleteCanteen(req.params.id);

  ApiResponse.ok(res, "Canteen deleted");
});

/**
 * Toggle canteen active status
 * PATCH /api/canteens/:id/toggle
 */
const toggleCanteenStatus = catchAsync(async (req, res) => {
  const canteen = await canteenService.toggleCanteenStatus(req.params.id);

  ApiResponse.ok(
    res,
    `Canteen is now ${canteen.isActive ? "active" : "inactive"}`,
    canteen,
  );
});

/**
 * Update canteen occupancy
 * PATCH /api/canteens/:id/occupancy
 */
const updateOccupancy = catchAsync(async (req, res) => {
  const { occupancy } = req.body;
  const canteen = await canteenService.updateOccupancy(
    req.params.id,
    occupancy,
  );

  ApiResponse.ok(res, "Occupancy updated", canteen);
});

const resetOccupancyOverride = catchAsync(async (req, res) => {
  const canteen = await canteenService.resetOccupancyOverride(req.params.id);
  ApiResponse.ok(res, "Occupancy override cleared", canteen);
});

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
