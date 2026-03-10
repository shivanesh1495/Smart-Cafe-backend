const { authenticate, optionalAuth } = require("./auth.middleware");
const {
  authorize,
  isAdmin,
  isManagement,
  isStaff,
  isAuthenticated,
  isOwnerOrAdmin,
  ROLE_GROUPS,
} = require("./rbac.middleware");
const {
  validate,
  validateBody,
  validateQuery,
} = require("./validate.middleware");
const {
  errorConverter,
  errorHandler,
  notFound,
  mongoErrorHandler,
} = require("./error.middleware");
const {
  apiLimiter,
  authLimiter,
  otpLimiter,
} = require("./rateLimiter.middleware");
const { menuImageUpload } = require("./upload.middleware");

module.exports = {
  // Auth
  authenticate,
  optionalAuth,

  // RBAC
  authorize,
  isAdmin,
  isManagement,
  isStaff,
  isAuthenticated,
  isOwnerOrAdmin,
  ROLE_GROUPS,

  // Validation
  validate,
  validateBody,
  validateQuery,

  // Error handling
  errorConverter,
  errorHandler,
  notFound,
  mongoErrorHandler,

  // Rate limiting
  apiLimiter,
  authLimiter,
  otpLimiter,

  // Uploads
  menuImageUpload,
};
