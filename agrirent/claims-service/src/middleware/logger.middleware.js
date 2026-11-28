const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      method: req.method,
      url: req.originalUrl || req.url,
      durationMs: duration,
    };

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${meta.url} - ${res.statusCode} (${duration}ms)`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${meta.url} - ${res.statusCode} (${duration}ms)`, meta);
    } else {
      logger.info(`${req.method} ${meta.url} - ${res.statusCode} (${duration}ms)`, meta);
    }
  });

  next();
}

module.exports = requestLogger;
