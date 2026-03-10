const express = require("express");
const router = express.Router();
const { systemController } = require("../controllers");
const {
  authenticate,
  isAdmin,
  isManagement,
  validate,
} = require("../middlewares");
const { systemValidation } = require("../validations");

// Public route for booking/walk-in status
router.get("/public", systemController.getPublicSettings);

// All other routes require authentication
router.use(authenticate);

// READ routes — accessible to managers AND admins
router.get("/audit", isManagement, systemController.getAuditLogs);
router.get(
  "/",
  isManagement,
  validate(systemValidation.getSettings),
  systemController.getAllSettings,
);
router.get("/grouped", isManagement, systemController.getSettingsGrouped);
router.get("/:key", isManagement, systemController.getSetting);

// WRITE routes — admin only
router.post("/backup", isAdmin, systemController.runBackup);
router.post(
  "/",
  isAdmin,
  validate(systemValidation.upsertSetting),
  systemController.upsertSetting,
);
router.post(
  "/bulk",
  isAdmin,
  validate(systemValidation.bulkUpdate),
  systemController.bulkUpdateSettings,
);
router.patch(
  "/:key",
  isManagement,
  validate(systemValidation.updateSettingValue),
  systemController.updateSettingValue,
);
router.delete("/:key", isAdmin, systemController.deleteSetting);

module.exports = router;
