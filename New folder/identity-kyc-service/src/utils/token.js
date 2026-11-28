const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'agrirent_super_secret_jwt_key_2026_dev';
const JWT_ISSUER = process.env.JWT_ISSUER || 'agrirent-identity';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'agrirent-services';
const JWT_EXPIRES_IN = parseInt(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS, 10) || 900; // 15 min default

const generateAccessToken = (user) => {
  const payload = {
    sub: user.userId,
    id: user.userId,
    email: user.email,
    phone: user.phone,
    roles: user.roles,
    kycStatus: user.kycStatus,
    accountStatus: user.accountStatus,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: JWT_EXPIRES_IN,
  };
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};
