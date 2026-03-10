const { userService } = require('../services');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get all users
 * GET /api/users
 */
const getUsers = catchAsync(async (req, res) => {
  const result = await userService.getUsers(req.query);
  
  ApiResponse.ok(res, 'Users retrieved', result);
});

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  
  ApiResponse.ok(res, 'User retrieved', user);
});

/**
 * Create new user (admin only)
 * POST /api/users
 */
const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  
  ApiResponse.created(res, 'User created', user);
});

/**
 * Update user
 * PATCH /api/users/:id
 */
const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  
  ApiResponse.ok(res, 'User updated', user);
});

/**
 * Update user role
 * PATCH /api/users/:id/role
 */
const updateRole = catchAsync(async (req, res) => {
  const user = await userService.updateRole(req.params.id, req.body.role);
  
  ApiResponse.ok(res, 'Role updated', user);
});

/**
 * Update user status
 * PATCH /api/users/:id/status
 */
const updateStatus = catchAsync(async (req, res) => {
  const user = await userService.updateStatus(req.params.id, req.body.status);
  
  ApiResponse.ok(res, 'Status updated', user);
});

/**
 * Force logout user
 * POST /api/users/:id/force-logout
 */
const forceLogout = catchAsync(async (req, res) => {
  const user = await userService.forceLogout(req.params.id);
  
  ApiResponse.ok(res, 'User logged out', user);
});

/**
 * Delete user
 * DELETE /api/users/:id
 */
const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUser(req.params.id);
  
  ApiResponse.ok(res, 'User deleted');
});

/**
 * Get user statistics
 * GET /api/users/stats
 */
const getUserStats = catchAsync(async (req, res) => {
  const stats = await userService.getUserStats();
  
  ApiResponse.ok(res, 'User statistics retrieved', stats);
});

/**
 * Assign staff to a canteen
 * PATCH /api/users/:id/canteen
 */
const assignCanteen = catchAsync(async (req, res) => {
  const user = await userService.assignCanteen(req.params.id, req.body.canteenId);
  
  ApiResponse.ok(res, 'Staff assigned to canteen', user);
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateRole,
  updateStatus,
  forceLogout,
  deleteUser,
  getUserStats,
  assignCanteen,
};
