const express = require("express");
const router = express.Router();
const { slotController } = require("../controllers");
const {
  authenticate,
  optionalAuth,
  isManagement,
  isStaff,
  validate,
} = require("../middlewares");
const { slotValidation } = require("../validations");

// Public route - get today's available slots
router.get("/today", optionalAuth, slotController.getTodaySlots);

// Protected routes
router.get(
  "/",
  authenticate,
  validate(slotValidation.getSlots),
  slotController.getSlots,
);
router.get("/:id", authenticate, slotController.getSlotById);

// Management routes
router.post(
  "/",
  authenticate,
  isManagement,
  validate(slotValidation.createSlot),
  slotController.createSlot,
);
router.patch(
  "/:id",
  authenticate,
  isManagement,
  validate(slotValidation.updateSlot),
  slotController.updateSlot,
);
router.patch(
  "/:id/capacity",
  authenticate,
  isManagement,
  validate(slotValidation.updateCapacity),
  slotController.updateCapacity,
);
router.post(
  "/:id/cancel",
  authenticate,
  isManagement,
  slotController.cancelSlot,
);
router.post(
  "/:id/disable",
  authenticate,
  isManagement,
  slotController.disableSlot,
);
router.post(
  "/:id/enable",
  authenticate,
  isManagement,
  slotController.enableSlot,
);
router.delete("/:id", authenticate, isManagement, slotController.deleteSlot);

module.exports = router;
