const mongoose = require("mongoose");
const config = require("./index");
const logger = require("../utils/logger");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  const { uri, retryCount, retryDelayMs } = config.mongodb;
  let attempt = 0;

  while (true) {
    try {
      const conn = await mongoose.connect(uri, {
        // Mongoose 6+ has these options enabled by default
      });

      logger.info(`MongoDB Connected: ${conn.connection.host}`);

      // Handle connection events
      mongoose.connection.on("error", (err) => {
        logger.error("MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        logger.warn("MongoDB disconnected");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed due to app termination");
        process.exit(0);
      });

      return conn;
    } catch (error) {
      attempt += 1;
      logger.error(
        `Error connecting to MongoDB (attempt ${attempt}): ${error.message}`,
      );

      if (retryCount > 0 && attempt >= retryCount) {
        throw error;
      }

      await sleep(retryDelayMs);
    }
  }
};

module.exports = connectDB;
