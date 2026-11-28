const { verifyAccessToken } = require('../utils/token');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const environment = require('../config/environment');

/**
 * Validates Bearer JWT access token and ensures user account is ACTIVE.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required. Missing or malformed Bearer token.'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    const userId = decoded.sub || decoded.userId || decoded.id;

    const user = await User.findOne({ userId });
    if (!user) {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'User belonging to this token no longer exists.'));
    }

    // Check account status
    if (user.accountStatus === 'BLOCKED') {
      return next(new ApiError(403, 'ACCOUNT_BLOCKED', 'This account has been blocked due to policy violations.'));
    }
    if (user.accountStatus === 'SUSPENDED') {
      return next(new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account is currently suspended pending administrative review.'));
    }
    if (user.accountStatus === 'DEACTIVATED') {
      return next(new ApiError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated.'));
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'TOKEN_EXPIRED', 'Authentication token has expired. Please log in again.'));
    }
    return next(new ApiError(401, 'INVALID_TOKEN', 'Authentication token verification failed.'));
  }
};

/**
 * Validates service-to-service credentials for internal endpoints.
 */
const requireServiceAuth = (req, res, next) => {
  const clientId = req.headers['x-service-client-id'];
  const clientSecret = req.headers['x-service-client-secret'];

  // 1. Direct service client credentials
  if (
    clientId &&
    clientSecret &&
    clientId === environment.serviceClientId &&
    clientSecret === environment.serviceClientSecret
  ) {
    req.serviceCaller = { id: clientId, type: 'INTERNAL_SERVICE' };
    return next();
  }

  // 2. Alternatively check Bearer JWT with ADMIN or SERVICE claim
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded.roles && decoded.roles.includes('ADMIN')) {
        req.serviceCaller = { id: decoded.sub, type: 'ADMIN' };
        return next();
      }
    } catch {
      // Fall through to 401
    }
  }

  // 3. In dev / test mode, allow if test header or internal loopback
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-service'] === 'true') {
    req.serviceCaller = { id: 'test-service', type: 'TEST' };
    return next();
  }

  return next(
    new ApiError(
      401,
      'UNAUTHENTICATED',
      'Valid service-to-service credentials (x-service-client-id & x-service-client-secret) are required.'
    )
  );
};

module.exports = {
  requireAuth,
  requireServiceAuth,
};
