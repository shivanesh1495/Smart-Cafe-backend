const { calendarService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");

const createEvent = catchAsync(async (req, res) => {
  const event = await calendarService.createEvent(req.body, req.user._id);
  ApiResponse.created(res, "Event created", event);
});

const getAllEvents = catchAsync(async (req, res) => {
  const events = await calendarService.getAllEvents(req.query);
  ApiResponse.ok(res, "Events retrieved", events);
});

const getActiveEvents = catchAsync(async (req, res) => {
  const events = await calendarService.getActiveEvents(req.query.date);
  ApiResponse.ok(res, "Active events retrieved", events);
});

const getDemandAdjustment = catchAsync(async (req, res) => {
  const adjustment = await calendarService.getEventDemandAdjustment(
    req.query.date || new Date(),
  );
  ApiResponse.ok(res, "Demand adjustment retrieved", adjustment);
});

const updateEvent = catchAsync(async (req, res) => {
  const event = await calendarService.updateEvent(req.params.id, req.body);
  ApiResponse.ok(res, "Event updated", event);
});

const deleteEvent = catchAsync(async (req, res) => {
  await calendarService.deleteEvent(req.params.id);
  ApiResponse.ok(res, "Event deleted");
});

module.exports = {
  createEvent,
  getAllEvents,
  getActiveEvents,
  getDemandAdjustment,
  updateEvent,
  deleteEvent,
};
