require("dotenv").config();

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3000,

  mongodb: {
    uri:
      process.env.MONGODB_URI ||
      "mongodb+srv://mcshivanesh777:Shivanesh%401495@shiva1.osdbukz.mongodb.net/smart-cafe?retryWrites=true&w=majority",
    retryCount: Number.isNaN(parseInt(process.env.MONGODB_RETRY_COUNT, 10))
      ? 0
      : parseInt(process.env.MONGODB_RETRY_COUNT, 10),
    retryDelayMs: Number.isNaN(parseInt(process.env.MONGODB_RETRY_DELAY_MS, 10))
      ? 2000
      : parseInt(process.env.MONGODB_RETRY_DELAY_MS, 10),
  },

  jwt: {
    secret:
      process.env.JWT_SECRET ||
      (process.env.NODE_ENV === "production"
        ? (() => {
            throw new Error("JWT_SECRET must be set in production");
          })()
        : "dev-secret-not-for-production"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      (process.env.NODE_ENV === "production"
        ? (() => {
            throw new Error("JWT_REFRESH_SECRET must be set in production");
          })()
        : "dev-refresh-secret-not-for-production"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || "Smart Cafe <noreply@smartcafe.com>",
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
};
