const { Builder } = require('xml2js');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'unknown';
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred';
  let details = err.details || null;

  // Handle syntax error for malformed JSON request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = 'Malformed JSON in request payload';
  }

  // Handle SQLite constraint violations
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    code = 'DUPLICATE_REQUEST';
    message = 'A unique constraint violation occurred in the database.';
  }

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    logger.error(`[Unhandled Server Error] [${correlationId}] ${err.stack || err.message}`);
  }

  const errorBody = {
    error: {
      code,
      message,
      correlationId,
      ...(details ? { details } : {}),
    },
  };

  // Check if client requested XML representation
  const accept = req.headers['accept'] || '';
  if (req.responseFormat === 'xml' || accept.includes('application/xml') || accept.includes('text/xml')) {
    const builder = new Builder({
      rootName: 'response',
      headless: false,
      renderOpts: { pretty: true, indent: '  ', newline: '\n' },
    });
    const xml = builder.buildObject(errorBody);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(statusCode).send(xml);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(errorBody);
};

module.exports = errorHandler;
