const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financial.controller');
const { authenticate, isManagement, isAdmin } = require('../middlewares');

// All routes require authentication and management role
router.use(authenticate);
router.use(isManagement);

// Reports (most used first)
router.get('/summary/daily', financialController.getDailySummary);
router.get('/summary/monthly', financialController.getMonthlySummary);
router.get('/settlement', isAdmin, financialController.getSettlementReport);

// Transaction management
router.get('/', financialController.getTransactions);
router.get('/:id', financialController.getTransactionById);
router.post('/', financialController.createTransaction);
router.post('/expense', financialController.recordExpense);

module.exports = router;
