const { systemService, backupService } = require("../services");
const { AuditLog } = require("../models");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const { emitToAll } = require("../utils/socketEmitter");

/**
 * Get all settings
 * GET /api/system
 */
const getAllSettings = catchAsync(async (req, res) => {
  const settings = await systemService.getAllSettings(req.query.category);

  ApiResponse.ok(res, "Settings retrieved", settings);
});

/**
 * Get settings grouped by category
 * GET /api/system/grouped
 */
const getSettingsGrouped = catchAsync(async (req, res) => {
  const settings = await systemService.getSettingsGrouped();

  ApiResponse.ok(res, "Settings retrieved", settings);
});

/**
 * Get public settings for booking/walk-in
 * GET /api/system/public
 */
const getPublicSettings = catchAsync(async (req, res) => {
  const settings = await systemService.getPublicSettings();

  ApiResponse.ok(res, "Public settings retrieved", settings);
});

/**
 * Run a manual backup
 * POST /api/system/backup
 */
const runBackup = catchAsync(async (req, res) => {
  const result = await backupService.runBackup({
    triggeredBy: req.userId,
    source: "manual",
  });

  await AuditLog.log({
    action: "Manual backup created",
    user: req.userId,
    userName: "Admin",
    resource: "Backup",
    details: {
      fileName: result.fileName,
    },
  });

  ApiResponse.ok(res, "Backup completed", result);
});

/**
 * Get recent audit logs
 * GET /api/system/audit
 */
const getAuditLogs = catchAsync(async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const entries = await systemService.getAuditLogs(limit);

  ApiResponse.ok(res, "Audit logs retrieved", entries);
});

/**
 * Get setting by key
 * GET /api/system/:key
 */
const getSetting = catchAsync(async (req, res) => {
  const setting = await systemService.getSetting(req.params.key);

  ApiResponse.ok(res, "Setting retrieved", setting);
});

/**
 * Create or update setting
 * POST /api/system
 */
const upsertSetting = catchAsync(async (req, res) => {
  const setting = await systemService.upsertSetting(req.body);

  ApiResponse.ok(res, "Setting saved", setting);
});

/**
 * Update setting value
 * PATCH /api/system/:key
 */
const updateSettingValue = catchAsync(async (req, res) => {
  const setting = await systemService.updateSettingValue(
    req.params.key,
    req.body.value,
    req.userId,
  );

  // Broadcast setting change in real-time so staff/student dashboards update instantly
  emitToAll("settings:updated", {
    key: req.params.key.toUpperCase(),
    value: req.body.value,
    setting,
  });

  ApiResponse.ok(res, "Setting updated", setting);
});

/**
 * Bulk update settings
 * POST /api/system/bulk
 */
const bulkUpdateSettings = catchAsync(async (req, res) => {
  const results = await systemService.bulkUpdateSettings(
    req.body.settings,
    req.userId,
  );

  emitToAll("settings:updated", {
    bulk: true,
    settings: results,
  });

  ApiResponse.ok(res, "Settings updated", results);
});

/**
 * Delete setting
 * DELETE /api/system/:key
 */
const deleteSetting = catchAsync(async (req, res) => {
  await systemService.deleteSetting(req.params.key);

  ApiResponse.ok(res, "Setting deleted");
});

module.exports = {
  getAllSettings,
  getSettingsGrouped,
  getPublicSettings,
  getAuditLogs,
  runBackup,
  getSetting,
  upsertSetting,
  updateSettingValue,
  bulkUpdateSettings,
  deleteSetting,
};
