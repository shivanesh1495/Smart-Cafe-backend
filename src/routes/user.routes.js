const express = require('express');
const router = express.Router();
const { userController } = require('../controllers');
const { authenticate, isAdmin, isManagement, validate } = require('../middlewares');
const { userValidation } = require('../validations');

// All routes require authentication
router.use(authenticate);

// Stats route (Management)
router.get('/stats', isManagement, userController.getUserStats);

// User CRUD routes (Admin only)
router.get('/', isManagement, validate(userValidation.getUsers), userController.getUsers);
router.post('/', isAdmin, validate(userValidation.createUser), userController.createUser);
router.get('/:id', isManagement, validate(userValidation.getUserById), userController.getUserById);
router.patch('/:id', isAdmin, validate(userValidation.updateUser), userController.updateUser);
router.delete('/:id', isAdmin, validate(userValidation.getUserById), userController.deleteUser);

// Role and status management (Admin only)
router.patch('/:id/role', isAdmin, validate(userValidation.updateRole), userController.updateRole);
router.patch('/:id/status', isAdmin, validate(userValidation.updateStatus), userController.updateStatus);
router.post('/:id/force-logout', isAdmin, validate(userValidation.getUserById), userController.forceLogout);

// Canteen assignment (Management - manager can assign staff to their canteen)
router.patch('/:id/canteen', isManagement, userController.assignCanteen);

module.exports = router;
