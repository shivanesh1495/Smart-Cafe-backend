const http = require("http");
const app = require("./app");
const config = require("./config");
const connectDB = require("./config/database");
const logger = require("./utils/logger");
const {
  systemService,
  backupService,
  bookingService,
  notificationService,
  forecastService,
} = require("./services");
const { AuditLog } = require("./models");
const { initSocket } = require("./socket");

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Initialize default settings
    await systemService.initializeDefaults();
    logger.info("System settings initialized");

    const parseBoolean = (value, fallback) => {
      if (value === null || value === undefined || value === "")
        return fallback;
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return Boolean(value);
    };

    // Store interval references for cleanup
    const intervals = [];

    let lastBackupDate = null;
    intervals.push(
      setInterval(async () => {
        try {
          const enabledValue = await systemService.getSettingValue(
            "AUTO_BACKUP_ENABLED",
          );
          const enabled = parseBoolean(enabledValue, true);
          if (!enabled) return;

          const now = new Date();
          if (now.getHours() !== 2 || now.getMinutes() !== 0) return;

          const todayKey = now.toISOString().slice(0, 10);
          if (lastBackupDate === todayKey) return;

          const result = await backupService.runBackup({ source: "auto" });
          await AuditLog.log({
            action: "Auto backup created",
            userName: "System",
            userRole: "system",
            resource: "Backup",
            details: {
              fileName: result.fileName,
            },
          });
          lastBackupDate = todayKey;
          logger.info(`Auto backup completed: ${result.fileName}`);
        } catch (error) {
          logger.error("Auto backup failed:", error);
        }
      }, 60000),
    );

    intervals.push(
      setInterval(async () => {
        try {
          await bookingService.releaseNoShowSlots();
        } catch (error) {
          logger.error("No-show release failed:", error);
        }
      }, 60000),
    );

    // Process scheduled notification reminders every 30 seconds
    intervals.push(
      setInterval(async () => {
        try {
          await notificationService.processScheduledReminders();
        } catch (error) {
          logger.error("Scheduled reminder processing failed:", error);
        }
      }, 30000),
    );

    // Saturday night: export weekly actuals to ML dataset
    let lastMLExportWeek = null;
    intervals.push(
      setInterval(async () => {
        try {
          const now = new Date();
          // Saturday = day 6, after 23:55
          if (
            now.getDay() !== 6 ||
            now.getHours() !== 23 ||
            now.getMinutes() < 55
          )
            return;

          const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7)}`;
          if (lastMLExportWeek === weekKey) return;

          const result = await forecastService.exportWeekToMLDataset();
          lastMLExportWeek = weekKey;
          logger.info(
            `[ML Export] Weekly export completed: ${result.exported} records`,
          );
        } catch (error) {
          logger.error("ML weekly export failed:", error);
        }
      }, 60000),
    );

    // Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    initSocket(server);

    // Start server – bind to 0.0.0.0 so mobile devices on the LAN can connect
    server.listen(config.port, "0.0.0.0", () => {
      logger.info(
        `Server running in ${config.env} mode on port ${config.port}`,
      );
      logger.info(`API available at http://localhost:${config.port}/api`);
      logger.info(`LAN access at http://0.0.0.0:${config.port}/api`);
      logger.info(`Socket.IO ready on port ${config.port}`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      // Clear all intervals
      intervals.forEach((interval) => clearInterval(interval));
      logger.info(`Cleared ${intervals.length} background intervals`);
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
      // Force exit after 10s if connections don't close
      setTimeout(() => {
        logger.warn("Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
      logger.error("Unhandled Rejection:", err);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught Exception:", err);
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
