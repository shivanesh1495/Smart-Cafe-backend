const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { authenticate, authLimiter, otpLimiter, validate } = require('../middlewares');
const { authValidation } = require('../validations');

// Public routes
router.post('/register', validate(authValidation.register), authController.register);
router.post('/login', authLimiter, validate(authValidation.login), authController.login);
router.post('/send-otp', otpLimiter, validate(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', validate(authValidation.verifyOtp), authController.verifyOtp);
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
