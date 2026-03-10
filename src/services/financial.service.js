const mongoose = require("mongoose");
const FinancialTransaction = require("../models/FinancialTransaction");
const { Booking } = require("../models");
const {
  parsePagination,
  paginateResponse,
  getDayBounds,
} = require("../utils/helpers");
const ApiError = require("../utils/ApiError");

const normalizeCanteenId = (canteenId) => {
  if (!canteenId) return null;
  if (typeof canteenId === "string") return canteenId;
  if (typeof canteenId.toString === "function") return canteenId.toString();
  return String(canteenId);
};

const buildCanteenFilter = (canteenId) => {
  const normalizedId = normalizeCanteenId(canteenId);
  if (!normalizedId) return null;

  // Support legacy docs that may have stored ObjectId instead of string.
  if (mongoose.Types.ObjectId.isValid(normalizedId)) {
    return {
      $or: [
        { canteenId: normalizedId },
        { canteenId: new mongoose.Types.ObjectId(normalizedId) },
      ],
    };
  }

  return { canteenId: normalizedId };
};

/**
 * Get all financial transactions with filters
 */
const getTransactions = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (query.transactionType) filter.transactionType = query.transactionType;
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.canteenId) {
    Object.assign(filter, buildCanteenFilter(query.canteenId));
  }
  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
  }

  const [transactions, total] = await Promise.all([
    FinancialTransaction.find(filter)
      .populate("performedBy", "fullName")
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 }),
    FinancialTransaction.countDocuments(filter),
  ]);

  return paginateResponse(transactions, total, page, limit, "transactions");
};

/**
 * Get transaction by ID
 */
const getTransactionById = async (id) => {
  const transaction = await FinancialTransaction.findById(id).populate(
    "performedBy",
    "fullName",
  );
  if (!transaction) throw new ApiError(404, "Transaction not found");
  return transaction;
};

/**
 * Create transaction
 */
const createTransaction = async (data, userId) => {
  const transaction = await FinancialTransaction.create({
    ...data,
    performedBy: userId,
  });
  return transaction;
};

/**
 * Record sale from booking
 */
const recordBookingSale = async (booking) => {
  return await FinancialTransaction.create({
    transactionType: "SALE",
    amount: booking.totalAmount,
    description: `Booking sale - Token ${booking.tokenNumber}`,
    category: "BOOKING",
    referenceType: "BOOKING",
    referenceId: booking._id,
    paymentMethod: "WALLET",
    status: "COMPLETED",
  });
};

/**
 * Record cash sale for immediate walkins / scanned tokens
 */
const recordCashSale = async (amount, description, canteenId, staffId) => {
  const normalizedCanteenId = normalizeCanteenId(canteenId);

  return await FinancialTransaction.create({
    transactionType: "SALE",
    amount: Math.abs(amount),
    description: description,
    category: "BOOKING",
    paymentMethod: "CASH",
    status: "COMPLETED",
    canteenId: normalizedCanteenId || "default",
    performedBy: staffId,
  });
};

/**
 * Record refund
 */
const recordRefund = async (booking, reason, userId) => {
  return await FinancialTransaction.create({
    transactionType: "REFUND",
    amount: -booking.totalAmount,
    description: `Refund for booking ${booking.tokenNumber} - ${reason}`,
    category: "REFUND",
    referenceType: "BOOKING",
    referenceId: booking._id,
    paymentMethod: "WALLET",
    status: "COMPLETED",
    performedBy: userId,
  });
};

/**
 * Record expense
 */
const recordExpense = async (data, userId) => {
  return await FinancialTransaction.create({
    transactionType: "EXPENSE",
    amount: -Math.abs(data.amount),
    description: data.description,
    category: data.category || "OTHER",
    paymentMethod: data.paymentMethod || "CASH",
    status: "COMPLETED",
    performedBy: userId,
    metadata: data.metadata,
  });
};

/**
 * Get daily summary
 */
const getDailySummary = async (date, canteenId) => {
  const { start, end } = getDayBounds(date || new Date());

  // Build base match filter
  const baseMatch = { date: { $gte: start, $lte: end }, status: "COMPLETED" };
  if (canteenId) {
    Object.assign(baseMatch, buildCanteenFilter(canteenId));
  }

  const [summary, byCategory, byPaymentMethod] = await Promise.all([
    FinancialTransaction.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$transactionType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    FinancialTransaction.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    FinancialTransaction.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalRevenue = summary
    .filter((s) => s._id === "SALE")
    .reduce((acc, s) => acc + s.total, 0);
  const totalExpenses = summary
    .filter((s) => ["EXPENSE", "REFUND"].includes(s._id))
    .reduce((acc, s) => acc + Math.abs(s.total), 0);

  return {
    date: start,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    byType: summary,
    byCategory,
    byPaymentMethod,
  };
};

/**
 * Get monthly summary
 */
const getMonthlySummary = async (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const [dailyTotals, summary] = await Promise.all([
    FinancialTransaction.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: "COMPLETED",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "SALE"] }, "$amount", 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [
                { $in: ["$transactionType", ["EXPENSE", "REFUND"]] },
                { $abs: "$amount" },
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    FinancialTransaction.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: "COMPLETED",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "SALE"] }, "$amount", 0],
            },
          },
          totalExpenses: {
            $sum: {
              $cond: [
                { $in: ["$transactionType", ["EXPENSE", "REFUND"]] },
                { $abs: "$amount" },
                0,
              ],
            },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    year,
    month,
    startDate,
    endDate,
    totalRevenue: summary[0]?.totalRevenue || 0,
    totalExpenses: summary[0]?.totalExpenses || 0,
    netIncome:
      (summary[0]?.totalRevenue || 0) - (summary[0]?.totalExpenses || 0),
    transactionCount: summary[0]?.transactionCount || 0,
    dailyTotals,
  };
};

/**
 * Get settlement report
 */
const getSettlementReport = async (startDate, endDate) => {
  const filter = {
    status: "COMPLETED",
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
  };

  const [transactions, summary] = await Promise.all([
    FinancialTransaction.find(filter).sort({ date: 1 }),
    FinancialTransaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalAmount = summary.reduce((acc, s) => acc + s.totalAmount, 0);

  return {
    period: { startDate, endDate },
    totalAmount,
    byPaymentMethod: summary,
    transactionCount: transactions.length,
    transactions,
  };
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  recordBookingSale,
  recordCashSale,
  recordRefund,
  recordExpense,
  getDailySummary,
  getMonthlySummary,
  getSettlementReport,
};
