const ApiError = require('../utils/ApiError');

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Resource not found: ${req.method} ${req.originalUrl}`));
};

module.exports = notFoundHandler;
