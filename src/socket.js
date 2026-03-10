const { Server } = require("socket.io");
const { verifyToken } = require("./config/jwt");
const { User } = require("./models");
const logger = require("./utils/logger");

let io = null;

/**
 * Initialize Socket.IO server and attach to the HTTP server.
 * Authenticates each connection using the JWT token sent by the client.
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // ----- Authentication middleware -----
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select("_id role fullName");
      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user info to the socket for later use
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userName = user.fullName;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  // ----- Connection handler -----
  io.on("connection", (socket) => {
    logger.info(
      `🔌 Socket connected: ${socket.userName} (${socket.userRole}) [${socket.id}]`
    );

    // Join personal room and role-based room
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);

    // Handle notification:read events from the client
    socket.on("notification:read", (data) => {
      logger.info(
        `Notification ${data?.notificationId} marked read by ${socket.userId}`
      );
    });

    socket.on("disconnect", (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.userName} — ${reason}`);
    });
  });

  logger.info("✅ Socket.IO server initialized");
  return io;
};

/**
 * Get the Socket.IO server instance.
 * Returns null if not yet initialized (safe for early calls).
 */
const getIO = () => io;

module.exports = { initSocket, getIO };
