const express = require('express');
const router = express.Router();
const { menuController } = require('../controllers');
const { authenticate, optionalAuth, isManagement, validate } = require('../middlewares');
const { menuValidation } = require('../validations');

// ==================== MENU ROUTES ====================

// Public routes (with optional auth)
router.get('/', optionalAuth, validate(menuValidation.getMenus), menuController.getMenus);
router.get('/:id', optionalAuth, menuController.getMenuById);

// Protected routes (Management only)
router.post('/', authenticate, isManagement, validate(menuValidation.createMenu), menuController.createMenu);
router.patch('/:id', authenticate, isManagement, validate(menuValidation.updateMenu), menuController.updateMenu);
router.delete('/:id', authenticate, isManagement, menuController.deleteMenu);

module.exports = router;
