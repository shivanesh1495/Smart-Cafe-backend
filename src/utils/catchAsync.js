/**
 * Async handler wrapper to avoid try-catch in every controller
 * Catches errors and passes them to the error handling middleware
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
