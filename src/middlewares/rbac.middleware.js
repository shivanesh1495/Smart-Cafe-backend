const ApiError = require('../utils/ApiError');

/**
 * Role-Based Access Control (RBAC) middleware
 * Checks if authenticated user has required role(s)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    // Normalize role names (handle both underscore and camelCase)
    const userRole = req.user.role.toLowerCase().replace(/_/g, '');
    const normalizedAllowedRoles = allowedRoles.map(role => 
      role.toLowerCase().replace(/_/g, '')
    );
    
    // Check if user's role is in allowed roles
    if (!normalizedAllowedRoles.includes(userRole)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`
        )
      );
    }
    
    next();
  };
};

/**
 * Predefined role groups for common access patterns
 */
const ROLE_GROUPS = {
  ADMIN_ONLY: ['admin'],
  MANAGEMENT: ['admin', 'manager'],
  STAFF: ['admin', 'manager', 'canteen_staff', 'kitchen_staff', 'counter_staff'],
  ALL_STAFF: ['canteen_staff', 'kitchen_staff', 'counter_staff'],
  AUTHENTICATED: ['admin', 'manager', 'canteen_staff', 'kitchen_staff', 'counter_staff', 'user'],
};

/**
 * Helper middleware factories
 */
const isAdmin = authorize(...ROLE_GROUPS.ADMIN_ONLY);
const isManagement = authorize(...ROLE_GROUPS.MANAGEMENT);
const isStaff = authorize(...ROLE_GROUPS.STAFF);
const isAuthenticated = authorize(...ROLE_GROUPS.AUTHENTICATED);

/**
 * Check if user owns the resource or is admin
 */
const isOwnerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    // Admins can access anything
    if (req.user.role === 'admin') {
      return next();
    }
    
    try {
      const ownerId = await getResourceOwnerId(req);
      
      if (!ownerId) {
        return next(ApiError.notFound('Resource not found'));
      }
      
      if (ownerId.toString() !== req.user._id.toString()) {
        return next(ApiError.forbidden('Access denied'));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authorize,
  isAdmin,
  isManagement,
  isStaff,
  isAuthenticated,
  isOwnerOrAdmin,
  ROLE_GROUPS,
};
