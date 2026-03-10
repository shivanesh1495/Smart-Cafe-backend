const { sustainabilityService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const { emitToAll } = require("../utils/socketEmitter");
const logger = require("../utils/logger");

/**
 * Submit waste report
 * POST /api/sustainability/waste-report
 */
const submitWasteReport = catchAsync(async (req, res) => {
  const report = await sustainabilityService.submitWasteReport(
    req.userId,
    req.body,
  );

  // Refresh eco-scores in the background after a new report
  sustainabilityService
    .refreshEcoScores()
    .catch((err) => logger.error("Eco-score refresh error:", err.message));

  // Broadcast so manager dashboard waste control updates in real-time
  emitToAll("sustainability:updated", { action: "waste-report", report });

  ApiResponse.created(res, "Waste report submitted", report);
});

/**
 * Get user's waste reports
 * GET /api/sustainability/my-reports
 */
const getMyWasteReports = catchAsync(async (req, res) => {
  const result = await sustainabilityService.getUserWasteReports(
    req.userId,
    req.query,
  );

  ApiResponse.ok(res, "Waste reports retrieved", result);
});

/**
 * Get all waste reports (Admin/Manager)
 * GET /api/sustainability/reports
 */
const getAllWasteReports = catchAsync(async (req, res) => {
  const result = await sustainabilityService.getAllWasteReports(req.query);
  ApiResponse.ok(res, "All waste reports retrieved", result);
});

/**
 * Get waste statistics (Admin/Manager)
 * GET /api/sustainability/stats
 */
const getWasteStats = catchAsync(async (req, res) => {
  const result = await sustainabilityService.getWasteStats(req.query);

  ApiResponse.ok(res, "Waste statistics retrieved", result);
});

/**
 * Get sustainability metrics
 * GET /api/sustainability/metrics
 */
const getSustainabilityMetrics = catchAsync(async (req, res) => {
  const result = await sustainabilityService.getSustainabilityMetrics(
    req.userId,
  );

  ApiResponse.ok(res, "Sustainability metrics retrieved", result);
});

/**
 * Log a surplus food donation
 * POST /api/sustainability/donations
 */
const logDonation = catchAsync(async (req, res) => {
  const result = await sustainabilityService.logDonation(req.body, req.userId);

  ApiResponse.created(res, "Donation logged and students notified", result);
});

/**
 * Get donation history
 * GET /api/sustainability/donations
 */
const getDonationHistory = catchAsync(async (req, res) => {
  const result = await sustainabilityService.getDonationHistory(req.query);

  ApiResponse.ok(res, "Donation history retrieved", result);
});

module.exports = {
  submitWasteReport,
  getMyWasteReports,
  getAllWasteReports,
  getWasteStats,
  getSustainabilityMetrics,
  logDonation,
  getDonationHistory,
};
