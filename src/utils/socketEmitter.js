const { getIO } = require("../socket");

/**
 * Safely emit a Socket.IO event to ALL connected clients.
 */
const emitToAll = (event, data) => {
  const io = getIO();
  if (io) {
    io.emit(event, data);
  }
};

/**
 * Safely emit a Socket.IO event to a specific user's personal room.
 */
const emitToUser = (userId, event, data) => {
  const io = getIO();
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Safely emit a Socket.IO event to all users of a specific role.
 */
const emitToRole = (role, event, data) => {
  const io = getIO();
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
};

module.exports = { emitToAll, emitToUser, emitToRole };
