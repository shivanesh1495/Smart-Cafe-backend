const Holiday = require('../models/Holiday');
const { parsePagination, paginateResponse, getDayBounds } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

/**
 * Create a holiday
 */
const createHoliday = async (data, userId) => {
  const holiday = await Holiday.create({
    ...data,
    createdBy: userId,
  });
  
  return holiday;
};

/**
 * Get all holidays
 */
const getHolidays = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  
  const filter = {};
  
  if (query.year) {
    const startDate = new Date(query.year, 0, 1);
    const endDate = new Date(query.year, 11, 31);
    filter.date = { $gte: startDate, $lte: endDate };
  }
  
  if (query.canteenId) {
    filter.canteenId = query.canteenId;
  }
  
  const [holidays, total] = await Promise.all([
    Holiday.find(filter)
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit),
    Holiday.countDocuments(filter),
  ]);
  
  return paginateResponse(holidays, total, page, limit);
};

/**
 * Get upcoming holidays
 */
const getUpcomingHolidays = async (days = 30) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  
  const holidays = await Holiday.find({
    date: { $gte: today, $lte: endDate },
  }).sort({ date: 1 });
  
  return holidays;
};

/**
 * Check if date is a holiday
 */
const isHoliday = async (date, canteenId = 'default') => {
  const holiday = await Holiday.isHoliday(date, canteenId);
  return { isHoliday: !!holiday, holiday };
};

/**
 * Update holiday
 */
const updateHoliday = async (id, data) => {
  const holiday = await Holiday.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  );
  
  if (!holiday) {
    throw ApiError.notFound('Holiday not found');
  }
  
  return holiday;
};

/**
 * Delete holiday
 */
const deleteHoliday = async (id) => {
  const holiday = await Holiday.findByIdAndDelete(id);
  
  if (!holiday) {
    throw ApiError.notFound('Holiday not found');
  }
  
  return { deleted: true };
};

module.exports = {
  createHoliday,
  getHolidays,
  getUpcomingHolidays,
  isHoliday,
  updateHoliday,
  deleteHoliday,
};
