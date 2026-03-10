const { authService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");

/**
 * Register new user
 * POST /api/auth/register
 */
const register = catchAsync(async (req, res) => {
  const { fullName, email, password, role } = req.body;

  const result = await authService.register({
    fullName,
    email,
    password,
    role,
  });

  ApiResponse.created(res, "Registration successful", result);
});

/**
 * Login user
 * POST /api/auth/login
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const result = await authService.login({ email, password });

  ApiResponse.ok(res, "Login successful", result);
});

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = catchAsync(async (req, res) => {
  await authService.logout(req.userId);

  ApiResponse.ok(res, "Logged out successfully");
});

/**
 * Send OTP for password reset
 * POST /api/auth/send-otp
 */
const sendOtp = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await authService.sendOtp(email);

  ApiResponse.ok(res, result.message);
});

/**
 * Verify OTP
 * POST /api/auth/verify-otp
 */
const verifyOtp = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  const result = await authService.verifyOtp(email, otp);

  ApiResponse.ok(res, result.message);
});

/**
 * Reset password
 * POST /api/auth/reset-password
 */
const resetPassword = catchAsync(async (req, res) => {
  const { email, otp, password } = req.body;

  const result = await authService.resetPassword(email, otp, password);

  ApiResponse.ok(res, result.message);
});

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = catchAsync(async (req, res) => {
  ApiResponse.ok(res, "Profile retrieved", req.user);
});

module.exports = {
  register,
  login,
  logout,
  sendOtp,
  verifyOtp,
  resetPassword,
  getMe,
};
