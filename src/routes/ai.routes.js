const express = require("express");
const router = express.Router();
const { aiController } = require("../controllers");
const { optionalAuth, authenticate, authorize } = require("../middlewares");

// Essential endpoints only - to conserve API credits
router.post("/nutrients", optionalAuth, aiController.getNutrition);
router.get("/recommendations", authenticate, aiController.getRecommendations);
router.post("/chat", authenticate, aiController.chat);
router.post("/diet-check", authenticate, aiController.getDietRecommendations);

// DISABLED - These endpoints consume unnecessary AI credits
// router.get("/inventory-insights", authenticate, authorize('manager', 'admin'), aiController.getInventoryInsights);
// router.get("/queue/predict/:canteenId", authenticate, aiController.predictWaitTime);

module.exports = router;
