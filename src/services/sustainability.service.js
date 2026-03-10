const WasteReport = require('../models/WasteReport');
const { Booking, Canteen, MenuItem } = require('../models');
const { parsePagination, paginateResponse, getDayBounds } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

const WASTE_WEIGHTS = {
  None: 100,
  Little: 80,
  Some: 50,
  Most: 20,
  All: 0,
};

/**
 * Convert a numeric eco-score (0-100) to a letter grade
 */
const scoreToGrade = (score) => {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'E';
};

/**
 * Submit a waste report
 */
const submitWasteReport = async (userId, data) => {
  const report = await WasteReport.create({
    user: userId,
    booking: data.bookingId,
    wasteAmount: data.wasteAmount,
    reason: data.reason,
    notes: data.notes,
    mealType: data.mealType,
  });
  
  return report;
};

/**
 * Get user's waste reports
 */
const getUserWasteReports = async (userId, query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  
  const [reports, total] = await Promise.all([
    WasteReport.find({ user: userId })
      .populate('booking')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WasteReport.countDocuments({ user: userId }),
  ]);
  
  return paginateResponse(reports, total, page, limit);
};

/**
 * Get all waste reports (Admin/Manager)
 */
const getAllWasteReports = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const { startDate, endDate, mealType } = query;
  
  const filter = {};
  if (startDate && endDate) {
    filter.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  if (mealType) {
    filter.mealType = mealType;
  }
  
  const [reports, total] = await Promise.all([
    WasteReport.find(filter)
      .populate('user', 'name fullName email studentId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WasteReport.countDocuments(filter),
  ]);
  
  return paginateResponse(reports, total, page, limit);
};

/**
 * Get waste statistics (Admin/Manager)
 */
const getWasteStats = async (query = {}) => {
  const { startDate, endDate, mealType } = query;
  
  const matchStage = {};
  
  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  
  if (mealType) {
    matchStage.mealType = mealType;
  }
  
  // Aggregate waste reports
  const stats = await WasteReport.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$wasteAmount',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
  
  // Calculate waste by reason
  const byReason = await WasteReport.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
  
  // Calculate daily trends
  const dailyTrend = await WasteReport.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' },
        },
        totalReports: { $sum: 1 },
        highWasteCount: {
          $sum: {
            $cond: [{ $in: ['$wasteAmount', ['Most', 'All']] }, 1, 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);
  
  // Calculate eco-score (lower waste = higher score)
  let totalScore = 0;
  let totalReports = 0;
  
  stats.forEach((s) => {
    totalScore += (WASTE_WEIGHTS[s._id] || 50) * s.count;
    totalReports += s.count;
  });
  
  const averageEcoScore = totalReports > 0 
    ? Math.round(totalScore / totalReports) 
    : 100;
  
  return {
    byWasteAmount: stats,
    byReason,
    dailyTrend,
    averageEcoScore,
    totalReports,
  };
};

/**
 * Get sustainability metrics for dashboard.
 * If userId is provided, returns the user's personal eco-score.
 */
const getSustainabilityMetrics = async (userId) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [recentStats, previousStats] = await Promise.all([
    getWasteStats({ startDate: thirtyDaysAgo, endDate: today }),
    getWasteStats({
      startDate: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: thirtyDaysAgo,
    }),
  ]);
  
  const improvement = previousStats.averageEcoScore > 0
    ? Math.round(((recentStats.averageEcoScore - previousStats.averageEcoScore) / previousStats.averageEcoScore) * 100)
    : 0;

  // If a userId is provided, compute personal eco-score from that user's reports
  let personalEcoScore = recentStats.averageEcoScore;
  if (userId) {
    const userReports = await WasteReport.find({
      user: userId,
      date: { $gte: thirtyDaysAgo, $lte: today },
    });
    if (userReports.length > 0) {
      const userTotal = userReports.reduce(
        (sum, r) => sum + (WASTE_WEIGHTS[r.wasteAmount] || 50),
        0,
      );
      personalEcoScore = Math.round(userTotal / userReports.length);
    }
  }
  
  return {
    currentEcoScore: personalEcoScore,
    globalEcoScore: recentStats.averageEcoScore,
    previousEcoScore: previousStats.averageEcoScore,
    improvement,
    totalReportsThisMonth: recentStats.totalReports,
  };
};

/**
 * Refresh eco-scores for canteens and menu items based on waste report data.
 * Called after a waste report is submitted, or on-demand.
 */
const refreshEcoScores = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // --- Canteen eco-scores ---
  // Get bookings linked to waste reports, grouped by the slot's canteenId
  const canteenWaste = await WasteReport.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo } } },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bookingData',
      },
    },
    { $unwind: { path: '$bookingData', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'slots',
        localField: 'bookingData.slot',
        foreignField: '_id',
        as: 'slotData',
      },
    },
    { $unwind: { path: '$slotData', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$slotData.canteenId',
        reports: { $push: '$wasteAmount' },
      },
    },
  ]);

  for (const entry of canteenWaste) {
    if (!entry._id) continue;
    const totalScore = entry.reports.reduce(
      (sum, w) => sum + (WASTE_WEIGHTS[w] || 50),
      0,
    );
    const avg = totalScore / entry.reports.length;
    const grade = scoreToGrade(avg);

    await Canteen.updateMany(
      {
        $or: [
          { _id: entry._id },
          { _id: { $exists: false } }, // dummy to avoid empty $or
        ],
      },
      { $set: { ecoScore: grade } },
    ).catch(() => {
      // canteenId might be a string, not an ObjectId — try string match
    });
    // Also try by string canteenId
    const canteen = await Canteen.findById(entry._id).catch(() => null);
    if (canteen) {
      canteen.ecoScore = grade;
      await canteen.save();
    }
  }

  // --- Menu item eco-scores ---
  const itemWaste = await WasteReport.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo }, booking: { $exists: true } } },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bookingData',
      },
    },
    { $unwind: '$bookingData' },
    { $unwind: '$bookingData.items' },
    {
      $group: {
        _id: '$bookingData.items.menuItem',
        reports: { $push: '$wasteAmount' },
      },
    },
  ]);

  for (const entry of itemWaste) {
    if (!entry._id) continue;
    const totalScore = entry.reports.reduce(
      (sum, w) => sum + (WASTE_WEIGHTS[w] || 50),
      0,
    );
    const avg = totalScore / entry.reports.length;
    const grade = scoreToGrade(avg);

    await MenuItem.findByIdAndUpdate(entry._id, { ecoScore: grade }).catch(
      () => {},
    );
  }

  return { refreshed: true };
};

/**
 * Log a surplus food donation (Staff/Manager)
 */
const logDonation = async (data, userId) => {
  const SurplusDonation = require('../models/SurplusDonation');
  const notificationService = require('./notification.service');

  const donation = await SurplusDonation.create({
    items: data.items,
    totalQuantity: data.totalQuantity,
    donatedTo: data.donatedTo,
    mealType: data.mealType,
    notes: data.notes,
    loggedBy: userId,
    canteenId: data.canteenId || 'default',
    status: data.donatedTo ? 'donated' : 'pending',
  });

  // Notify all students about the donation
  await notificationService.sendBroadcast({
    title: '🌱 Surplus Food Donated!',
    message: `${data.totalQuantity} portions of surplus food ${data.donatedTo ? `donated to ${data.donatedTo}` : 'are being processed for donation'}. Thank you for being part of zero-waste initiative!`,
    type: 'announcement',
    roles: ['user'],
  });

  return donation;
};

/**
 * Get donation history
 */
const getDonationHistory = async (query = {}) => {
  const SurplusDonation = require('../models/SurplusDonation');

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.startDate && query.endDate) {
    filter.date = { $gte: new Date(query.startDate), $lte: new Date(query.endDate) };
  }

  const donations = await SurplusDonation.find(filter)
    .sort({ date: -1 })
    .limit(parseInt(query.limit) || 50)
    .populate('loggedBy', 'fullName');

  return donations;
};

module.exports = {
  submitWasteReport,
  getUserWasteReports,
  getAllWasteReports,
  getWasteStats,
  getSustainabilityMetrics,
  refreshEcoScores,
  logDonation,
  getDonationHistory,
};

