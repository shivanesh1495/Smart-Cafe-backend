const holidayService = require('../services/holiday.service');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Create a holiday
 * POST /api/system/holidays
 */
const createHoliday = catchAsync(async (req, res) => {
  const holiday = await holidayService.createHoliday(req.body, req.userId);
  
  ApiResponse.created(res, 'Holiday created', holiday);
});

/**
 * Get all holidays
 * GET /api/system/holidays
 */
const getHolidays = catchAsync(async (req, res) => {
  const result = await holidayService.getHolidays(req.query);
  
  ApiResponse.ok(res, 'Holidays retrieved', result);
});

/**
 * Get upcoming holidays
 * GET /api/system/holidays/upcoming
 */
const getUpcomingHolidays = catchAsync(async (req, res) => {
  const holidays = await holidayService.getUpcomingHolidays(req.query.days);
  
  ApiResponse.ok(res, 'Upcoming holidays retrieved', holidays);
});

/**
 * Check if date is a holiday
 * GET /api/system/holidays/check
 */
const checkHoliday = catchAsync(async (req, res) => {
  const result = await holidayService.isHoliday(req.query.date, req.query.canteenId);
  
  ApiResponse.ok(res, 'Holiday check completed', result);
});

/**
 * Update holiday
 * PUT /api/system/holidays/:id
 */
const updateHoliday = catchAsync(async (req, res) => {
  const holiday = await holidayService.updateHoliday(req.params.id, req.body);
  
  ApiResponse.ok(res, 'Holiday updated', holiday);
});

/**
 * Delete holiday
 * DELETE /api/system/holidays/:id
 */
const deleteHoliday = catchAsync(async (req, res) => {
  await holidayService.deleteHoliday(req.params.id);
  
  ApiResponse.ok(res, 'Holiday deleted');
});

module.exports = {
  createHoliday,
  getHolidays,
  getUpcomingHolidays,
  checkHoliday,
  updateHoliday,
  deleteHoliday,
};
