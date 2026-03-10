const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const config = require("./config");
const routes = require("./routes");
const {
  errorConverter,
  errorHandler,
  notFound,
  mongoErrorHandler,
  apiLimiter,
} = require("./middlewares");

const app = express();

// Security middleware (with exemptions for static files)
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow CORS for static files
    crossOriginOpenerPolicy: false, // Prevent COOP from blocking images
  }),
);

// CORS configuration with proper origin whitelist
const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "https://kailee-preextensive-verda.ngrok-free.dev",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      // In development, allow all origins for Flutter web dynamic ports
      if (config.env === "development") return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "ngrok-skip-browser-warning",
    ],
  }),
);

// Request logging
if (config.env !== "test") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Public static files (uploaded menu images, etc.) - with explicit CORS allowing
const corsOptions = {
  origin: "*",
  methods: ["GET", "HEAD", "OPTIONS"],
  allowedHeaders: "*",
};

app.use("/uploads", cors(corsOptions));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rate limiting
if (config.env === "production") {
  app.use("/api", apiLimiter);
}

// API routes
app.use("/api", routes);

// Error handling
app.use(notFound);
app.use(mongoErrorHandler);
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
