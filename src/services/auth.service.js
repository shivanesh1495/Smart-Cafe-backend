const { User } = require("../models");
const { generateToken } = require("../config/jwt");
const { generateOTP, sanitizeUser } = require("../utils/helpers");
const { sendOtpEmail } = require("./email.service");
const config = require("../config");
const ApiError = require("../utils/ApiError");

/**
 * Register a new user
 */
const register = async ({ fullName, email, password, role = "user" }) => {
  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict("Email already registered");
  }

  // Normalize role (accept both formats: 'User' or 'user', 'CanteenStaff' or 'canteen_staff')
  let normalizedRole = role.toLowerCase();

  // Convert camelCase to snake_case
  if (normalizedRole === "canteenstaff") normalizedRole = "canteen_staff";
  if (normalizedRole === "kitchenstaff") normalizedRole = "kitchen_staff";
  if (normalizedRole === "counterstaff") normalizedRole = "counter_staff";

  // Create user
  const user = await User.create({
    fullName,
    email: email.toLowerCase(),
    password,
    role: normalizedRole,
    isOnline: true,
  });

  // Generate token
  const token = generateToken({ id: user._id, role: user.role });

  return {
    user: sanitizeUser(user),
    token,
  };
};

/**
 * Login user
 */
const login = async ({ email, password }) => {
  // Find user with password
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password",
  );

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Check if suspended
  if (user.status === "suspended") {
    throw ApiError.forbidden("Account has been suspended");
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Update last login and online status
  user.lastLogin = new Date();
  user.isOnline = true;
  await user.save();

  // Generate token
  const token = generateToken({ id: user._id, role: user.role });

  // Dashboard redirect based on role
  const DASHBOARD_URLS = {
    user: '/student/dashboard',
    canteen_staff: '/staff/dashboard',
    kitchen_staff: '/staff/dashboard',
    counter_staff: '/staff/dashboard',
    manager: '/manager/dashboard',
    admin: '/admin/dashboard',
  };

  return {
    user: sanitizeUser(user),
    token,
    dashboardUrl: DASHBOARD_URLS[user.role] || '/student/dashboard',
  };
};

/**
 * Send OTP for password reset
 */
const sendOtp = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Don't reveal if email exists
    return { message: "If the email exists, an OTP has been sent" };
  }

  // Generate OTP
  const otp = generateOTP(6);

  // Set OTP and expiry
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);
  await user.save();

  // Send email
  await sendOtpEmail(email, otp);

  return { message: "OTP sent successfully" };
};

/**
 * Verify OTP
 */
const verifyOtp = async (email, otp) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+otp +otpExpiry",
  );

  if (!user) {
    throw ApiError.badRequest("Invalid OTP");
  }

  if (!user.isOtpValid(otp)) {
    throw ApiError.badRequest("Invalid or expired OTP");
  }

  return { message: "OTP verified successfully" };
};

/**
 * Reset password
 */
const resetPassword = async (email, otp, newPassword) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+otp +otpExpiry +password",
  );

  if (!user) {
    throw ApiError.badRequest("Invalid request");
  }

  if (!user.isOtpValid(otp)) {
    throw ApiError.badRequest("Invalid or expired OTP");
  }

  // Update password and clear OTP
  user.password = newPassword;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return { message: "Password reset successful" };
};

/**
 * Logout user
 */
const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { isOnline: false });
  return { message: "Logged out successfully" };
};

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  resetPassword,
  logout,
};
