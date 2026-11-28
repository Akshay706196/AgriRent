const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'unknown';
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred';
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_FAILED';
    message = 'Validation error occurred on document attributes';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = `Invalid format for field: ${err.path}`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    code = 'RESOURCE_EXISTS';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A user or record with this ${field} already exists`;
    details = err.keyValue;
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = 'Malformed JSON in request payload';
  }

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[IDENTITY ERROR] [${correlationId}]`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      correlationId,
      ...(details ? { details } : {}),
    },
  });
};

module.exports = errorHandler;
