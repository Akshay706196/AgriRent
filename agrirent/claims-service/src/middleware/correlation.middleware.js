const crypto = require('crypto');

function correlationMiddleware(req, res, next) {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    `corr-${crypto.randomBytes(8).toString('hex')}`;

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}

module.exports = correlationMiddleware;
