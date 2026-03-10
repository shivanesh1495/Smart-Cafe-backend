const express = require("express");
const { authenticate, authorize } = require("../middlewares");
const feedbackController = require("../controllers/feedback.controller");

const router = express.Router();

// User routes
router.post("/", authenticate, feedbackController.submitFeedback);

// Manager/Admin routes
router.get(
  "/",
  authenticate,
  authorize("admin", "manager"),
  feedbackController.getFeedback
);

module.exports = router;
