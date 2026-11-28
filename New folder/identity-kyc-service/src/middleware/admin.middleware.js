const ApiError = require('../utils/ApiError');

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
  }

  if (!req.user.roles || !req.user.roles.includes('ADMIN')) {
    return next(
      new ApiError(403, 'FORBIDDEN', 'Administrative privileges are required to perform this action.')
    );
  }

  next();
};

module.exports = {
  requireAdmin,
};
