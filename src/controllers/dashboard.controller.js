const { User, Booking, Slot, MenuItem } = require('../models');
const { getDayBounds } = require('../utils/helpers');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get admin dashboard stats
 * GET /api/dashboard/admin
 */
const getAdminDashboard = catchAsync(async (req, res) => {
  const { start, end } = getDayBounds(new Date());
  
  const [
    totalUsers,
    activeUsers,
    todayBookings,
    totalRevenue,
    usersByRole,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'active' }),
    Booking.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Booking.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
  ]);
  
  ApiResponse.ok(res, 'Dashboard stats retrieved', {
    totalUsers,
    activeUsers,
    todayBookings,
    todayRevenue: totalRevenue[0]?.total || 0,
    usersByRole: usersByRole.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {}),
  });
});

/**
 * Get manager dashboard stats
 * GET /api/dashboard/manager
 */
const getManagerDashboard = catchAsync(async (req, res) => {
  const { start, end } = getDayBounds(new Date());
  
  const [
    todayBookings,
    slotStats,
    popularItems,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Slot.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          totalBooked: { $sum: '$booked' },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.menuItem', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'menuitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
      { $project: { name: '$item.itemName', count: 1 } },
    ]),
  ]);
  
  ApiResponse.ok(res, 'Dashboard stats retrieved', {
    bookingsByStatus: todayBookings.reduce((acc, b) => {
      acc[b._id] = b.count;
      return acc;
    }, {}),
    slotStats,
    popularItems,
  });
});

/**
 * Get staff dashboard stats
 * GET /api/dashboard/staff
 */
const getStaffDashboard = catchAsync(async (req, res) => {
  const { start, end } = getDayBounds(new Date());
  
  const [
    pendingBookings,
    completedToday,
    currentSlot,
  ] = await Promise.all([
    Booking.countDocuments({
      status: 'confirmed',
      createdAt: { $gte: start, $lte: end },
    }),
    Booking.countDocuments({
      status: 'completed',
      completedAt: { $gte: start, $lte: end },
    }),
    Slot.findOne({
      date: { $gte: start, $lte: end },
      status: { $in: ['Open', 'FastFilling'] },
    }).sort({ time: 1 }),
  ]);
  
  ApiResponse.ok(res, 'Dashboard stats retrieved', {
    pendingBookings,
    completedToday,
    currentSlot,
  });
});

/**
 * Get student dashboard
 * GET /api/dashboard/student
 */
const getStudentDashboard = catchAsync(async (req, res) => {
  const { start, end } = getDayBounds(new Date());
  
  const [
    myBookings,
    availableSlots,
  ] = await Promise.all([
    Booking.find({
      user: req.userId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate('slot')
      .sort({ createdAt: -1 })
      .limit(5),
    Slot.find({
      date: { $gte: start, $lte: end },
      status: { $in: ['Open', 'FastFilling'] },
    }).sort({ time: 1 }),
  ]);
  
  ApiResponse.ok(res, 'Dashboard retrieved', {
    myBookings,
    availableSlots,
  });
});

module.exports = {
  getAdminDashboard,
  getManagerDashboard,
  getStaffDashboard,
  getStudentDashboard,
};
