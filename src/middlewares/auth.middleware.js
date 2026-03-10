const { verifyToken } = require('../config/jwt');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = catchAsync(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is required');
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    throw ApiError.unauthorized('Access token is required');
  }
  
  try {
    // Verify token
    const decoded = verifyToken(token);
    
    // Find user
    const user = await User.findById(decoded.id);
    
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }
    
    if (user.status === 'suspended') {
      throw ApiError.forbidden('Account has been suspended');
    }

    // Force Logout Check: If user is marked offline, invalidate session even if token is valid
    if (!user.isOnline) {
      throw ApiError.unauthorized('Session expired. Please login again.');
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw ApiError.unauthorized('Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token has expired');
    }
    throw error;
  }
});

/**
 * Optional authentication - doesn't throw error if no token
 */
const optionalAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      
      if (user && user.status === 'active') {
        req.user = user;
        req.userId = user._id;
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
  }
  
  next();
});

module.exports = {
  authenticate,
  optionalAuth,
};
