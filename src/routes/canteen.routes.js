const express = require("express");
const router = express.Router();
const { canteenController } = require("../controllers");
const { authenticate, optionalAuth, isManagement } = require("../middlewares");

// ==================== CANTEEN ROUTES ====================

// Public routes (with optional auth)
router.get("/config", canteenController.getCanteenConfig);
router.get("/", optionalAuth, canteenController.getCanteens);
router.get("/:id", optionalAuth, canteenController.getCanteenById);

// Protected routes (Management/Admin only)
router.post("/", authenticate, isManagement, canteenController.createCanteen);
router.patch(
  "/:id",
  authenticate,
  isManagement,
  canteenController.updateCanteen,
);
router.delete(
  "/:id",
  authenticate,
  isManagement,
  canteenController.deleteCanteen,
);
router.patch(
  "/:id/toggle",
  authenticate,
  isManagement,
  canteenController.toggleCanteenStatus,
);
router.patch(
  "/:id/occupancy",
  authenticate,
  isManagement,
  canteenController.updateOccupancy,
);
router.patch(
  "/:id/occupancy/reset",
  authenticate,
  isManagement,
  canteenController.resetOccupancyOverride,
);

module.exports = router;
