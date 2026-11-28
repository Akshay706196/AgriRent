const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'agrirent_super_secret_jwt_key_2026_dev';

/**
 * Validates JWT access token or development mock identity.
 */
const requireAuth = (req, res, next) => {
  const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.MOCK_AUTH === 'true';

  // 1. Development header mock (strictly disabled in production)
  if (isDevOrTest && req.headers['x-user-id'] && !req.headers.authorization) {
    req.user = {
      id: req.headers['x-user-id'],
      email: req.headers['x-user-email'] || `${req.headers['x-user-id']}@agrirent.internal`,
      role: req.headers['x-user-role'] || 'USER',
      kycStatus: req.headers['x-kyc-status'] || 'VERIFIED',
    };
    return next();
  }

  // 2. Standard Bearer JWT verification
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required. Missing or malformed Bearer token.'));
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
      return next(new ApiError(401, 'UNAUTHENTICATED', 'Token does not contain a valid user identifier claim.'));
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.'));
    }
    return next(new ApiError(401, 'INVALID_TOKEN', 'Authentication token verification failed.'));
  }
};

/**
 * Requires the authenticated user to have VERIFIED KYC status.
 */
const requireKyc = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
  }

  if (req.user.kycStatus !== 'VERIFIED') {
    return next(
      new ApiError(
        403,
        'KYC_REQUIRED',
        'Account must be KYC-verified to rent agricultural equipment. Complete verification in Identity Service.'
      )
    );
  }

  next();
};

/**
 * Validates internal service-to-service credentials via INTERNAL_SERVICE_TOKEN header or admin JWT.
 */
const requireServiceAuth = (req, res, next) => {
  const serviceToken =
    req.headers['internal_service_token'] ||
    req.headers['internal-service-token'] ||
    req.headers['x-internal-service-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';

  if (serviceToken && serviceToken === expectedToken) {
    req.serviceCaller = { type: 'INTERNAL_SERVICE' };
    return next();
  }

  // Also allow Bearer JWT with role ADMIN or SERVICE
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY || DEFAULT_JWT_SECRET);
      if (decoded.role === 'ADMIN' || decoded.role === 'SERVICE') {
        req.user = decoded;
        return next();
      }
    } catch (e) {
      // Fall through to 401
    }
  }

  // Allow in dev/test if bypass header present
  if ((process.env.NODE_ENV === 'test' || process.env.MOCK_AUTH === 'true') && req.headers['x-service-auth'] === 'true') {
    return next();
  }

  return next(new ApiError(401, 'UNAUTHORIZED_SERVICE', 'Invalid or missing internal service token.'));
};

/**
 * Helper to generate signed JWTs for testing or dev seeds.
 */
const generateToken = (payload, expiresIn = '24h') => {
  const secret = DEFAULT_JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn });
};

module.exports = {
  requireAuth,
  requireKyc,
  requireServiceAuth,
  generateToken,
};
