const crypto = require('crypto');

module.exports = (req, res, next) => {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['correlation-id'] ||
    `corr-${crypto.randomBytes(8).toString('hex')}`;

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};
