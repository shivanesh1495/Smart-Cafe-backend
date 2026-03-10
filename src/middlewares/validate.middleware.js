const ApiError = require('../utils/ApiError');

/**
 * Validation middleware factory using Joi schemas
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // Return all errors
      allowUnknown: true, // Allow unknown fields (they'll be stripped)
      stripUnknown: true, // Remove unknown fields
    };
    
    // Validate body, query, and params
    const { error, value } = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      validationOptions
    );
    
    if (error) {
      const errorMessages = error.details
        .map((detail) => detail.message)
        .join(', ');
      
      return next(ApiError.badRequest(errorMessages));
    }
    
    // Replace request data with validated data
    req.body = value.body || req.body;
    req.query = value.query || req.query;
    req.params = value.params || req.params;
    
    next();
  };
};

/**
 * Validate only body
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });
    
    if (error) {
      const errorMessages = error.details
        .map((detail) => detail.message)
        .join(', ');
      
      return next(ApiError.badRequest(errorMessages));
    }
    
    req.body = value;
    next();
  };
};

/**
 * Validate only query parameters
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });
    
    if (error) {
      const errorMessages = error.details
        .map((detail) => detail.message)
        .join(', ');
      
      return next(ApiError.badRequest(errorMessages));
    }
    
    req.query = value;
    next();
  };
};

module.exports = {
  validate,
  validateBody,
  validateQuery,
};
