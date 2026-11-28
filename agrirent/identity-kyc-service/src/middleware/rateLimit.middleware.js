const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

// Rate limiter for login endpoint
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 attempts in 15m in prod/dev
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many login attempts. Please try again later.'));
  },
});

// Rate limiter for registration
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many registration requests. Please try again later.'));
  },
});

module.exports = {
  loginRateLimiter,
  registerRateLimiter,
};
