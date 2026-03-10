const StockItem = require('../models/StockItem');
const StockTransaction = require('../models/StockTransaction');
const { parsePagination, paginateResponse, getDayBounds } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

/**
 * Get all stock items with filters
 */
const getStockItems = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { isActive: true };
  
  if (query.category) filter.category = query.category;
  if (query.stockStatus === 'LOW_STOCK') {
    filter.$expr = { $lte: ['$currentStock', '$minStockLevel'] };
  }
  if (query.canteen) filter.canteen = query.canteen;

  const [items, total] = await Promise.all([
    StockItem.find(filter)
      .populate('canteen', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ category: 1, itemName: 1 }),
    StockItem.countDocuments(filter),
  ]);

  return paginateResponse(items, total, page, limit, 'stockItems');
};

/**
 * Get stock item by ID
 */
const getStockItemById = async (id) => {
  const item = await StockItem.findById(id);
  if (!item) throw new ApiError(404, 'Stock item not found');
  return item;
};

/**
 * Create stock item
 */
const createStockItem = async (data) => {
  const item = await StockItem.create(data);
  return item;
};

/**
 * Update stock item
 */
const updateStockItem = async (id, data) => {
  const item = await StockItem.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, 'Stock item not found');
  return item;
};

/**
 * Delete stock item (soft delete)
 */
const deleteStockItem = async (id) => {
  const item = await StockItem.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!item) throw new ApiError(404, 'Stock item not found');
  return item;
};

/**
 * Restock an item
 */
const restockItem = async (id, quantity, unitPrice, userId, referenceNumber) => {
  const item = await StockItem.findById(id);
  if (!item) throw new ApiError(404, 'Stock item not found');

  const previousStock = item.currentStock;
  item.currentStock += quantity;
  item.lastRestocked = new Date();
  if (unitPrice) item.unitPrice = unitPrice;
  await item.save();

  // Record transaction
  await StockTransaction.create({
    stockItem: id,
    transactionType: 'RESTOCK',
    quantity,
    previousStock,
    newStock: item.currentStock,
    unitPrice: unitPrice || item.unitPrice,
    totalAmount: quantity * (unitPrice || item.unitPrice),
    performedBy: userId,
    referenceNumber,
  });

  return item;
};

/**
 * Consume stock
 */
const consumeStock = async (id, quantity, reason, userId) => {
  const item = await StockItem.findById(id);
  if (!item) throw new ApiError(404, 'Stock item not found');
  if (item.currentStock < quantity) throw new ApiError(400, 'Insufficient stock');

  const previousStock = item.currentStock;
  item.currentStock -= quantity;
  await item.save();

  await StockTransaction.create({
    stockItem: id,
    transactionType: 'CONSUME',
    quantity: -quantity,
    previousStock,
    newStock: item.currentStock,
    reason,
    performedBy: userId,
  });

  return item;
};

/**
 * Adjust stock (for corrections)
 */
const adjustStock = async (id, newQuantity, reason, userId) => {
  const item = await StockItem.findById(id);
  if (!item) throw new ApiError(404, 'Stock item not found');

  const previousStock = item.currentStock;
  const quantityChange = newQuantity - previousStock;
  item.currentStock = newQuantity;
  await item.save();

  await StockTransaction.create({
    stockItem: id,
    transactionType: 'ADJUST',
    quantity: quantityChange,
    previousStock,
    newStock: item.currentStock,
    reason,
    performedBy: userId,
  });

  return item;
};

/**
 * Get low stock alerts
 */
const getLowStockAlerts = async () => {
  const items = await StockItem.find({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minStockLevel'] },
  }).sort({ currentStock: 1 });

  return items;
};

/**
 * Get stock transactions
 */
const getStockTransactions = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (query.stockItem) filter.stockItem = query.stockItem;
  if (query.transactionType) filter.transactionType = query.transactionType;
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }

  const [transactions, total] = await Promise.all([
    StockTransaction.find(filter)
      .populate('stockItem', 'itemName category unit')
      .populate('performedBy', 'fullName')
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    StockTransaction.countDocuments(filter),
  ]);

  return paginateResponse(transactions, total, page, limit, 'transactions');
};

/**
 * Get stock summary/report
 */
const getStockSummary = async () => {
  const [totalValue, byCategory, lowStockCount, outOfStockCount] = await Promise.all([
    StockItem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalValue: { $sum: { $multiply: ['$currentStock', '$unitPrice'] } } } },
    ]),
    StockItem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', totalItems: { $sum: 1 }, totalStock: { $sum: '$currentStock' } } },
    ]),
    StockItem.countDocuments({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStockLevel'] },
      currentStock: { $gt: 0 },
    }),
    StockItem.countDocuments({ isActive: true, currentStock: 0 }),
  ]);

  return {
    totalInventoryValue: totalValue[0]?.totalValue || 0,
    byCategory,
    lowStockCount,
    outOfStockCount,
    totalItems: byCategory.reduce((acc, cat) => acc + cat.totalItems, 0),
  };
};

module.exports = {
  getStockItems,
  getStockItemById,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  restockItem,
  consumeStock,
  adjustStock,
  getLowStockAlerts,
  getStockTransactions,
  getStockSummary,
};
