const jwt = require("jsonwebtoken");

const QR_TOKEN_SECRET =
  process.env.QR_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "qr-token-secret-key-smart-cafe";
const QR_TOKEN_EXPIRY = "24h"; // QR tokens valid for 24 hours

/**
 * Generate a secure, signed QR token for a booking
 * @param {Object} bookingData - The booking data to encode
 * @returns {string} - Signed JWT token
 */
const generateQRToken = (bookingData) => {
  const {
    bookingId,
    tokenNumber,
    userId,
    userName,
    userEmail,
    slotTime,
    slotDate,
    slotStartTime,
    slotEndTime,
    totalAmount,
    items,
    status,
    expiryAt,
    canteenName,
    createdAt,
  } = bookingData;

  const payload = {
    // Token metadata
    type: "qr_booking_token",
    v: 1,

    // Booking identification
    bookingId,
    tokenNumber,

    // User information
    userId,
    userName,
    userEmail,

    // Slot information
    slotTime,
    slotDate,
    slotStartTime,
    slotEndTime,

    // Booking details
    totalAmount,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      portionSize: item.portionSize,
    })),

    // Status and timing
    status,
    expiryAt,
    canteenName,
    createdAt,

    // Token generation timestamp
    generatedAt: new Date().toISOString(),
  };

  // Sign the token with expiry
  const token = jwt.sign(payload, QR_TOKEN_SECRET, {
    expiresIn: QR_TOKEN_EXPIRY,
    issuer: "smart-cafe-backend",
    audience: "smart-cafe-staff",
  });

  return token;
};

/**
 * Verify and decode a QR token
 * @param {string} token - The JWT token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
const verifyQRToken = (token) => {
  try {
    const decoded = jwt.verify(token, QR_TOKEN_SECRET, {
      issuer: "smart-cafe-backend",
      audience: "smart-cafe-staff",
    });

    // Verify token type
    if (decoded.type !== "qr_booking_token") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("QR token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid or tampered QR token");
    }
    throw error;
  }
};

/**
 * Validate if QR token is still usable
 * @param {Object} decodedToken - The decoded token payload
 * @returns {Object} - Validation result
 */
const validateQRToken = (decodedToken) => {
  const errors = [];
  const warnings = [];

  // Check if booking has expired
  if (decodedToken.expiryAt) {
    const expiryTime = new Date(decodedToken.expiryAt);
    if (new Date() > expiryTime) {
      errors.push("Token has expired based on booking expiry time");
    }
  }

  // Check status
  if (decodedToken.status === "completed") {
    errors.push("This booking has already been completed");
  } else if (decodedToken.status === "cancelled") {
    errors.push("This booking has been cancelled");
  } else if (decodedToken.status === "no_show") {
    errors.push("This booking was marked as no-show");
  }

  // Check if slot time has passed significantly
  if (decodedToken.slotEndTime) {
    const slotEnd = new Date(decodedToken.slotEndTime);
    const hoursAfterSlot = (new Date() - slotEnd) / (1000 * 60 * 60);
    if (hoursAfterSlot > 2) {
      warnings.push("Slot time has passed by more than 2 hours");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

module.exports = {
  generateQRToken,
  verifyQRToken,
  validateQRToken,
};
