require('dotenv').config();

const environment = {
  port: parseInt(process.env.PORT, 10) || 4003,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agrirent_identity',
  jwtSecret: process.env.JWT_SECRET || 'agrirent_super_secret_jwt_key_2026_dev',
  jwtIssuer: process.env.JWT_ISSUER || 'agrirent-identity',
  jwtAudience: process.env.JWT_AUDIENCE || 'agrirent-services',
  jwtExpiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS, 10) || 900,
  serviceClientId: process.env.IDENTITY_SERVICE_CLIENT_ID || 'agrirent_internal_client',
  serviceClientSecret: process.env.IDENTITY_SERVICE_CLIENT_SECRET || 'agrirent_internal_secret_key_2026',
  adminBootstrap: {
    enabled: process.env.ADMIN_BOOTSTRAP_ENABLED === 'true',
    email: process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@agrirent.internal',
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'AdminStrongPass123!',
    name: process.env.ADMIN_BOOTSTRAP_NAME || 'System Administrator',
    phone: process.env.ADMIN_BOOTSTRAP_PHONE || '+919000000000',
  },
};

module.exports = environment;
