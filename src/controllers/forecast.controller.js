const forecastService = require("../services/forecast.service");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");

const getDailyForecast = catchAsync(async (req, res) => {
  const date = req.query.date || new Date();
  const canteenId = req.query.canteenId;
  const result = await forecastService.getDailyForecast(date, canteenId);
  ApiResponse.ok(res, "Daily forecast retrieved", result);
});

const getWeeklyForecast = catchAsync(async (req, res) => {
  const startDate = req.query.startDate || new Date();
  const canteenId = req.query.canteenId;
  const result = await forecastService.getWeeklyForecast(startDate, canteenId);
  ApiResponse.ok(res, "Weekly forecast retrieved", result);
});

const getHourlyForecast = catchAsync(async (req, res) => {
  const canteenId = req.query.canteenId;
  const result = await forecastService.getHourlyForecast(
    req.params.date,
    canteenId,
  );
  ApiResponse.ok(res, "Hourly forecast retrieved", result);
});

const getCategoryForecast = catchAsync(async (req, res) => {
  const canteenId = req.query.canteenId;
  const result = await forecastService.getCategoryForecast(
    req.params.date,
    canteenId,
  );
  ApiResponse.ok(res, "Category forecast retrieved", result);
});

const recordActual = catchAsync(async (req, res) => {
  const { date, mealType, actualCount, canteenId } = req.body;
  const forecast = await forecastService.recordActual(
    date,
    mealType,
    actualCount,
    canteenId,
  );
  ApiResponse.ok(res, "Actual consumption recorded", forecast);
});

const getAccuracyMetrics = catchAsync(async (req, res) => {
  const result = await forecastService.getAccuracyMetrics(req.query);
  ApiResponse.ok(res, "Accuracy metrics retrieved", result);
});

const getWeeklyTrends = catchAsync(async (req, res) => {
  const weeks = parseInt(req.query.weeks) || 12;
  const canteenId = req.query.canteenId;
  const result = await forecastService.getWeeklyTrends(weeks, canteenId);
  ApiResponse.ok(res, "Weekly trends retrieved", result);
});

const getMonthlyTrends = catchAsync(async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const canteenId = req.query.canteenId;
  const result = await forecastService.getMonthlyTrends(months, canteenId);
  ApiResponse.ok(res, "Monthly trends retrieved", result);
});

const getWeatherImpact = catchAsync(async (req, res) => {
  const result = await forecastService.getWeatherImpact();
  ApiResponse.ok(res, "Weather impact analysis retrieved", result);
});

const getForecastConfigs = catchAsync(async (req, res) => {
  const result = await forecastService.getForecastConfigs();
  ApiResponse.ok(res, "Forecast configs retrieved", result);
});

const createForecastConfig = catchAsync(async (req, res) => {
  const result = await forecastService.createForecastConfig(
    req.body,
    req.user._id,
  );
  ApiResponse.created(res, "Forecast config created", result);
});

const activateForecastConfig = catchAsync(async (req, res) => {
  const result = await forecastService.activateForecastConfig(req.params.id);
  ApiResponse.ok(res, "Forecast config activated", result);
});

const updateDataset = catchAsync(async (req, res) => {
  const result = await forecastService.exportWeekToMLDataset();
  ApiResponse.ok(res, "ML Dataset updated successfully", result);
});

module.exports = {
  updateDataset,
  getDailyForecast,
  getWeeklyForecast,
  getHourlyForecast,
  getCategoryForecast,
  recordActual,
  getAccuracyMetrics,
  getWeeklyTrends,
  getMonthlyTrends,
  getWeatherImpact,
  getForecastConfigs,
  createForecastConfig,
  activateForecastConfig,
};
