/**
 * Generate a random OTP of specified length
 */
const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

/**
 * Generate a unique token number for bookings
 */
const generateTokenNumber = () => {
  const prefix = "T";
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${number}`;
};

/**
 * Parse pagination parameters
 */
const parsePagination = (query) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build pagination response
 */
const paginateResponse = (data, total, page, limit, itemsKey = "items") => {
  const totalPages = Math.ceil(total / limit);

  return {
    [itemsKey]: data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Sanitize user object for response (remove sensitive fields)
 */
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.otp;
  delete userObj.otpExpiry;
  delete userObj.__v;

  // Rename _id to id for frontend consistency
  if (userObj._id) {
    userObj.id = userObj._id.toString();
    delete userObj._id;
  }

  return userObj;
};

/**
 * Format date to YYYY-MM-DD (using local timezone to avoid UTC date-shift)
 */
const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Get start and end of day for date queries
 */
const getDayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

module.exports = {
  generateOTP,
  generateTokenNumber,
  parsePagination,
  paginateResponse,
  sanitizeUser,
  formatDate,
  getDayBounds,
};
