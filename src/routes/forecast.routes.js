const express = require("express");
const router = express.Router();
const forecastController = require("../controllers/forecast.controller");
const { authenticate, isManagement, isAdmin } = require("../middlewares");

router.use(authenticate);

// Manager/Admin — Forecast viewing
router.get("/daily", isManagement, forecastController.getDailyForecast);
router.get("/weekly", isManagement, forecastController.getWeeklyForecast);
router.get("/hourly/:date", isManagement, forecastController.getHourlyForecast);
router.get(
  "/category/:date",
  isManagement,
  forecastController.getCategoryForecast,
);
router.get("/accuracy", isManagement, forecastController.getAccuracyMetrics);
router.get("/trends/weekly", isManagement, forecastController.getWeeklyTrends);
router.get(
  "/trends/monthly",
  isManagement,
  forecastController.getMonthlyTrends,
);
router.get(
  "/weather-impact",
  isManagement,
  forecastController.getWeatherImpact,
);

// Forecast configuration (Admin)
router.get("/configs", isAdmin, forecastController.getForecastConfigs);
router.post("/configs", isAdmin, forecastController.createForecastConfig);
router.post(
  "/configs/:id/activate",
  isAdmin,
  forecastController.activateForecastConfig,
);

// Record actuals (Management)
router.post("/record-actual", isManagement, forecastController.recordActual);

// Update ML Dataset (Admin)
router.post("/update-dataset", isAdmin, forecastController.updateDataset);

module.exports = router;
