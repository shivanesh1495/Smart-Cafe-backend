const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stock.controller');
const { authenticate, isManagement, isAdmin } = require('../middlewares');

// All routes require authentication and management role
router.use(authenticate);
router.use(isManagement);

// Summary and alerts (most used first)
router.get('/summary', stockController.getStockSummary);
router.get('/alerts', stockController.getLowStockAlerts);
router.get('/transactions', stockController.getStockTransactions);

// CRUD operations
router.get('/', stockController.getStockItems);
router.get('/:id', stockController.getStockItemById);
router.post('/', stockController.createStockItem);
router.patch('/:id', stockController.updateStockItem);
router.delete('/:id', isAdmin, stockController.deleteStockItem);

// Stock operations
router.post('/:id/restock', stockController.restockItem);
router.post('/:id/consume', stockController.consumeStock);
router.post('/:id/adjust', stockController.adjustStock);

module.exports = router;
