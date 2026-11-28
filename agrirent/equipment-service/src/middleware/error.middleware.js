const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'unknown';
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred';
  let details = err.details || null;

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_FAILED';
    message = 'Validation error occurred on document attributes';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Mongoose CastError (e.g., invalid ObjectId or numeric cast)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = `Invalid format for field: ${err.path}`;
  }

  // Handle duplicate key error in Mongo
  if (err.code === 11000) {
    statusCode = 409;
    code = 'RESOURCE_EXISTS';
    message = 'A resource with this identifier already exists';
    details = err.keyValue;
  }

  // Handle SyntaxError for bad JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = 'Malformed JSON in request payload';
  }

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[ERROR] [${correlationId}]`, err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      correlationId,
      ...(details ? { details } : {}),
    },
  });
};

module.exports = errorHandler;
