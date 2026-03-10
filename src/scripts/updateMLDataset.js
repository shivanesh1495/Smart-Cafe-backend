const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../../.env") });

const forecastService = require("../services/forecast.service");

mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(async () => {
    console.log("Connected to MongoDB for ML Dataset Update");

    try {
      const result = await forecastService.exportWeekToMLDataset();
      console.log(`ML Dataset update complete. Exported ${result.exported} records.`);
    } catch (err) {
      console.error("Failed to update ML Dataset:", err);
    } finally {
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
