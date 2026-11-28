const cors = require('cors');

const getAllowedOrigins = () => {
  const envOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173';
  return envOrigins.split(',').map((o) => o.trim());
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = getAllowedOrigins();
    if (!origin || allowed.includes(origin) || allowed.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed by AgriRent security policy.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'If-None-Match',
    'x-correlation-id',
    'internal_service_token',
    'Accept',
  ],
  exposedHeaders: [
    'ETag',
    'Link',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
    'Idempotent-Replayed',
    'x-correlation-id',
  ],
  credentials: true,
  maxAge: 86400,
};

module.exports = cors(corsOptions);
