const AcademicCalendar = require('../models/AcademicCalendar');
const ApiError = require('../utils/ApiError');

/**
 * Create a new academic calendar event
 */
const createEvent = async (data, userId) => {
  if (new Date(data.endDate) < new Date(data.startDate)) {
    throw ApiError.badRequest('End date must be after start date');
  }

  const event = await AcademicCalendar.create({
    ...data,
    createdBy: userId,
  });

  return event;
};

/**
 * Get all academic calendar events
 */
const getAllEvents = async (query = {}) => {
  const filter = {};

  if (query.eventType) {
    filter.eventType = query.eventType;
  }

  if (query.startDate && query.endDate) {
    filter.$or = [
      { startDate: { $gte: new Date(query.startDate), $lte: new Date(query.endDate) } },
      { endDate: { $gte: new Date(query.startDate), $lte: new Date(query.endDate) } },
      {
        startDate: { $lte: new Date(query.startDate) },
        endDate: { $gte: new Date(query.endDate) },
      },
    ];
  }

  return AcademicCalendar.find(filter).sort({ startDate: 1 });
};

/**
 * Get active events for a specific date
 */
const getActiveEvents = async (date) => {
  return AcademicCalendar.getActiveEvents(date || new Date());
};

/**
 * Get demand adjustment multiplier for a date
 */
const getEventDemandAdjustment = async (date) => {
  const events = await getActiveEvents(date);

  if (events.length === 0) {
    return { multiplier: 1.0, events: [], specialPeriodType: 'Normal' };
  }

  // Use the most impactful event's multiplier
  const sorted = events.sort((a, b) => Math.abs(b.demandMultiplier - 1) - Math.abs(a.demandMultiplier - 1));
  const primary = sorted[0];

  return {
    multiplier: primary.demandMultiplier,
    events: events.map((e) => ({
      name: e.name,
      type: e.eventType,
      multiplier: e.demandMultiplier,
    })),
    specialPeriodType: primary.eventType,
  };
};

/**
 * Update an academic calendar event
 */
const updateEvent = async (id, data) => {
  const event = await AcademicCalendar.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!event) {
    throw ApiError.notFound('Academic calendar event not found');
  }

  return event;
};

/**
 * Delete an academic calendar event
 */
const deleteEvent = async (id) => {
  const event = await AcademicCalendar.findByIdAndDelete(id);

  if (!event) {
    throw ApiError.notFound('Academic calendar event not found');
  }

  return { deleted: true };
};

module.exports = {
  createEvent,
  getAllEvents,
  getActiveEvents,
  getEventDemandAdjustment,
  updateEvent,
  deleteEvent,
};
