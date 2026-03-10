const express = require("express");
const router = express.Router();
const { menuController } = require("../controllers");
const {
  authenticate,
  optionalAuth,
  isAdmin,
  isManagement,
  isStaff,
  validate,
  menuImageUpload,
} = require("../middlewares");
const { menuValidation } = require("../validations");

// Public routes (students can view)
router.get("/", optionalAuth, menuController.getAllMenuItems);
router.get("/:id", optionalAuth, menuController.getMenuItemById);

// Protected upload route (Admin only)
router.post(
  "/upload-image",
  authenticate,
  isAdmin,
  menuImageUpload.single("image"),
  menuController.uploadMenuItemImage,
);

// Protected routes
router.post(
  "/",
  authenticate,
  isStaff,
  validate(menuValidation.createMenuItem),
  menuController.createMenuItem,
);
router.patch(
  "/:id",
  authenticate,
  isManagement,
  validate(menuValidation.updateMenuItem),
  menuController.updateMenuItem,
);
router.patch(
  "/:id/quantity",
  authenticate,
  isStaff,
  validate(menuValidation.updateMenuItemQuantity),
  menuController.updateMenuItemQuantity,
);
router.delete(
  "/:id",
  authenticate,
  isManagement,
  menuController.deleteMenuItem,
);
router.patch(
  "/:id/toggle",
  authenticate,
  isManagement,
  menuController.toggleItemAvailability,
);

module.exports = router;
