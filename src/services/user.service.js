const { User } = require('../models');
const { parsePagination, paginateResponse, sanitizeUser } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

/**
 * Get all users with filters and pagination
 */
const getUsers = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  
  // Build filter
  const filter = {};
  
  if (query.role && query.role !== 'all') {
    filter.role = query.role;
  }
  
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  
  // Filter by canteen assignment
  if (query.canteenId) {
    filter.canteenId = query.canteenId;
  }
  
  // Filter unassigned staff (no canteen)
  if (query.unassigned === 'true') {
    filter.canteenId = null;
  }
  
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  
  // Build sort
  const sort = {};
  if (query.sortBy) {
    sort[query.sortBy] = query.sortOrder === 'asc' ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }
  
  // Execute query
  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).populate('canteenId', 'name'),
    User.countDocuments(filter),
  ]);
  
  return paginateResponse(users, total, page, limit);
};

/**
 * Get user by ID
 */
const getUserById = async (id) => {
  const user = await User.findById(id);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  return user;
};

/**
 * Create new user (Admin only)
 */
const createUser = async (data) => {
  // Check if email exists
  const existingUser = await User.findOne({ email: data.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }
  
  const user = await User.create({
    ...data,
    email: data.email.toLowerCase(),
  });
  
  return user;
};

/**
 * Update user
 */
const updateUser = async (id, data) => {
  // If email is being updated, check for duplicates
  if (data.email) {
    const existingUser = await User.findOne({
      email: data.email.toLowerCase(),
      _id: { $ne: id },
    });
    if (existingUser) {
      throw ApiError.conflict('Email already in use');
    }
    data.email = data.email.toLowerCase();
  }
  
  const user = await User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  return user;
};

/**
 * Update user role
 */
const updateRole = async (id, role) => {
  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  );
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  return user;
};

/**
 * Update user status (activate/suspend)
 */
const updateStatus = async (id, status) => {
  const user = await User.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  return user;
};

/**
 * Force logout user
 */
const forceLogout = async (id) => {
  const user = await User.findByIdAndUpdate(
    id,
    { isOnline: false },
    { new: true }
  );
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  return user;
};

/**
 * Delete user
 */
const deleteUser = async (id) => {
  const user = await User.findByIdAndDelete(id);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  return user;
};

/**
 * Get user statistics
 */
const getUserStats = async () => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        online: {
          $sum: { $cond: ['$isOnline', 1, 0] },
        },
      },
    },
  ]);
  
  const total = await User.countDocuments();
  const activeCount = await User.countDocuments({ status: 'active' });
  const onlineCount = await User.countDocuments({ isOnline: true });
  
  return {
    total,
    active: activeCount,
    online: onlineCount,
    byRole: stats,
  };
};

/**
 * Assign staff to a canteen
 */
const assignCanteen = async (id, canteenId) => {
  const user = await User.findById(id);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  // Only staff roles can be assigned to canteens
  const staffRoles = ['canteen_staff', 'kitchen_staff', 'counter_staff', 'manager'];
  if (!staffRoles.includes(user.role)) {
    throw ApiError.badRequest('Only staff members can be assigned to canteens');
  }
  
  user.canteenId = canteenId || null;
  await user.save();
  
  return user;
};

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
