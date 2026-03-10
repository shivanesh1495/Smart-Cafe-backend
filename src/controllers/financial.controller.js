const financialService = require('../services/financial.service');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get all transactions
 * GET /api/financial
 */
const getTransactions = catchAsync(async (req, res) => {
  const result = await financialService.getTransactions(req.query);
  ApiResponse.ok(res, 'Transactions retrieved', result);
});

/**
 * Get transaction by ID
 * GET /api/financial/:id
 */
const getTransactionById = catchAsync(async (req, res) => {
  const transaction = await financialService.getTransactionById(req.params.id);
  ApiResponse.ok(res, 'Transaction retrieved', transaction);
});

/**
 * Create transaction (manual entry)
 * POST /api/financial
 */
const createTransaction = catchAsync(async (req, res) => {
  const transaction = await financialService.createTransaction(req.body, req.userId);
  ApiResponse.created(res, 'Transaction created', transaction);
});

/**
 * Record expense
 * POST /api/financial/expense
 */
const recordExpense = catchAsync(async (req, res) => {
  const transaction = await financialService.recordExpense(req.body, req.userId);
  ApiResponse.created(res, 'Expense recorded', transaction);
});

/**
 * Get daily summary
 * GET /api/financial/summary/daily
 */
const getDailySummary = catchAsync(async (req, res) => {
  const summary = await financialService.getDailySummary(req.query.date, req.query.canteenId);
  ApiResponse.ok(res, 'Daily summary retrieved', summary);
});

/**
 * Get monthly summary
 * GET /api/financial/summary/monthly
 */
const getMonthlySummary = catchAsync(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const summary = await financialService.getMonthlySummary(year, month);
  ApiResponse.ok(res, 'Monthly summary retrieved', summary);
});

/**
 * Get settlement report
 * GET /api/financial/settlement
 */
const getSettlementReport = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return ApiResponse.badRequest(res, 'Start date and end date are required');
  }
  const report = await financialService.getSettlementReport(startDate, endDate);
  ApiResponse.ok(res, 'Settlement report generated', report);
});

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  recordExpense,
  getDailySummary,
  getMonthlySummary,
  getSettlementReport,
};
