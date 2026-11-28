const crypto = require('crypto');

const correlationMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `req-${crypto.randomUUID()}`;
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};

module.exports = correlationMiddleware;
