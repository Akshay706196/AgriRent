const AppError = require('../utils/AppError');

const notFoundHandler = (req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Resource not found: ${req.method} ${req.originalUrl}`));
};

module.exports = notFoundHandler;
