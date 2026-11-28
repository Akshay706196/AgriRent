const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'agrirent_super_secret_jwt_key_2026_dev';

/**
 * Validates JWT access token or development mock identity.
 */
const requireAuth = (req, res, next) => {
  const isDevOrTest =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    process.env.MOCK_AUTH === 'true';

  // 1. Check for internal service token first
  const serviceToken =
    req.headers['internal_service_token'] ||
    req.headers['internal-service-token'] ||
    req.headers['x-internal-service-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';

  if (serviceToken && serviceToken === expectedToken) {
    req.user = { id: 'INTERNAL_SERVICE', role: 'ADMIN', isService: true, kycStatus: 'VERIFIED' };
    req.isService = true;
    return next();
  }

  // 2. Development header mock (strictly disabled in production)
  if (isDevOrTest && req.headers['x-user-id'] && !req.headers.authorization) {
    req.user = {
      id: req.headers['x-user-id'],
      email: req.headers['x-user-email'] || `${req.headers['x-user-id']}@agrirent.internal`,
      role: req.headers['x-user-role'] || 'USER',
      kycStatus: req.headers['x-kyc-status'] || 'VERIFIED',
    };
    return next();
  }

  // 3. Standard Bearer JWT verification
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required. Missing or malformed Bearer token.'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const secretOrKey = process.env.JWT_PUBLIC_KEY || DEFAULT_JWT_SECRET;
    const decoded = jwt.verify(token, secretOrKey);

    req.user = {
      id: decoded.sub || decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'USER',
      kycStatus: decoded.kycStatus || 'VERIFIED',
    };

    if (!req.user.id) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Token does not contain a valid user identifier claim.'));
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.'));
    }
    return next(new AppError(401, 'INVALID_TOKEN', 'Authentication token verification failed.'));
  }
};

/**
 * Requires verified KYC status for operations.
 */
const requireKyc = (req, res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
  }

  if (req.user.role !== 'ADMIN' && req.user.kycStatus !== 'VERIFIED') {
    return next(
      new AppError(
        403,
        'KYC_REQUIRED',
        'Account must be KYC-verified to file claims or reviews.'
      )
    );
  }

  next();
};

/**
 * Requires Admin privileges.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
  }

  if (req.user.role !== 'ADMIN') {
    return next(new AppError(403, 'ADMIN_REQUIRED', 'This operation requires administrator privileges.'));
  }

  next();
};

/**
 * Requires Admin privileges or Internal Service Token.
 */
const requireAdminOrService = (req, res, next) => {
  const serviceToken =
    req.headers['internal_service_token'] ||
    req.headers['internal-service-token'] ||
    req.headers['x-internal-service-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';

  if (serviceToken && serviceToken === expectedToken) {
    req.isService = true;
    req.user = req.user || { id: 'INTERNAL_SERVICE', role: 'ADMIN', isService: true };
    return next();
  }

  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }

  // Allow Bearer token with ADMIN role
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY || DEFAULT_JWT_SECRET);
      if (decoded.role === 'ADMIN') {
        req.user = {
          id: decoded.sub || decoded.id || decoded.userId,
          role: 'ADMIN',
        };
        return next();
      }
    } catch {
      // Fall through
    }
  }

  return next(
    new AppError(403, 'ACCESS_DENIED', 'Operation requires administrative or internal service privileges.')
  );
};

/**
 * Strictly requires Internal Service Token (e.g. For approved-deductions endpoint).
 */
const requireServiceToken = (req, res, next) => {
  const serviceToken =
    req.headers['internal_service_token'] ||
    req.headers['internal-service-token'] ||
    req.headers['x-internal-service-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';

  if (!serviceToken || serviceToken !== expectedToken) {
    return next(new AppError(403, 'INTERNAL_SERVICE_REQUIRED', 'Access restricted to internal service callers.'));
  }

  req.isService = true;
  next();
};

const generateToken = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, DEFAULT_JWT_SECRET, { expiresIn });
};

module.exports = {
  requireAuth,
  requireKyc,
  requireAdmin,
  requireAdminOrService,
  requireServiceToken,
  generateToken,
};
