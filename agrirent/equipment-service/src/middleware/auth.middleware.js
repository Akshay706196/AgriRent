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
        'Account must be KYC-verified to perform this action. Complete verification in Identity Service.'
      )
    );
  }

  next();
};

/**
 * Helper to generate signed JWTs for testing or seeds.
 */
const generateToken = (payload, expiresIn = '24h') => {
  const secret = DEFAULT_JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn });
};

module.exports = {
  requireAuth,
  requireKyc,
  generateToken,
};
