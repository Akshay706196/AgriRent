const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;
