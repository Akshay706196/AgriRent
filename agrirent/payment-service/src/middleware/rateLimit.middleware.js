const AppError = require('../utils/AppError');

// Memory store for IP request timestamps
const requestStore = new Map();

/**
 * Factory for creating rate limiters with standard IETF headers.
 * @param {Object} options
 * @param {number} options.windowMs Time window in milliseconds
 * @param {number} options.max Maximum requests per window
 * @param {string} options.name Name of the limiter
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
  const max = options.max || (options.strict ? parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS, 10) || 20 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100);
  const limiterKey = options.name || 'general';

  return (req, res, next) => {
    // In test environment, allow bypassing rate limits unless specifically testing rate limiting
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', max);
      res.setHeader('RateLimit-Reset', 60);
      return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const storeKey = `${limiterKey}:${clientIp}`;
    const now = Date.now();

    let clientData = requestStore.get(storeKey);
    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestStore.set(storeKey, clientData);
    }

    clientData.count += 1;
    const remaining = Math.max(0, max - clientData.count);
    const resetSeconds = Math.ceil((clientData.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (clientData.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Rate limit of ${max} requests per ${Math.round(windowMs / 1000)}s exceeded. Try again in ${resetSeconds}s.`
        )
      );
    }

    next();
  };
}

module.exports = {
  generalLimiter: createRateLimiter({ name: 'general', strict: false }),
  strictLimiter: createRateLimiter({ name: 'strict', strict: true }),
  createRateLimiter,
};
