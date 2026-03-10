const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Convert non-ApiError errors to ApiError
 */
const errorConverter = (err, req, res, next) => {
  let error = err;
  
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }
  
  next(error);
};

/**
 * Handle errors and send response
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  
  // In production, don't expose internal errors
  if (config.env === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Internal Server Error';
  }
  
  // Log error
  if (statusCode >= 500) {
    logger.error(message, { stack: err.stack, path: req.path, method: req.method });
  } else if (config.env === 'development') {
    logger.debug(`${statusCode} - ${message}`, { path: req.path });
  }
  
  const response = {
    success: false,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };
  
  res.status(statusCode).json(response);
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};

/**
 * Handle MongoDB duplicate key error
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  return ApiError.conflict(`${field} '${value}' already exists`);
};

/**
 * Handle MongoDB validation error
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => e.message);
  return ApiError.badRequest(errors.join(', '));
};

/**
 * Handle MongoDB CastError (invalid ObjectId)
 */
const handleCastError = (err) => {
  return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
};

/**
 * MongoDB error handler
 */
const mongoErrorHandler = (err, req, res, next) => {
  let error = err;
  
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  } else if (err.name === 'CastError') {
    error = handleCastError(err);
  }
  
  next(error);
};

module.exports = {
  errorConverter,
  errorHandler,
  notFound,
  mongoErrorHandler,
};
