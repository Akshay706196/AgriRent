const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  next(
    new AppError(
      404,
      'ROUTE_NOT_FOUND',
      `Cannot ${req.method} ${req.originalUrl}. Route not found.`
    )
  );
};
