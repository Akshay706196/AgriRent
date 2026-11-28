const cors = require('cors');

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser callers (origin is undefined) or allowlisted origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error(`Origin '${origin}' not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'If-None-Match',
    'X-Correlation-Id',
    'internal_service_token',
    'internal-service-token',
    'x-internal-service-token',
    'Accept',
  ],
  exposedHeaders: [
    'ETag',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
    'Link',
    'Idempotency-Key',
    'Idempotent-Replayed',
    'X-Correlation-Id',
  ],
  credentials: true,
  maxAge: 86400,
};

module.exports = cors(corsOptions);
