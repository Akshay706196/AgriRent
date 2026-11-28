const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const AppError = require('../utils/AppError');

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true,
  removeAdditional: false,
});
addFormats(ajv);

/**
 * Creates an Express validation middleware using Ajv JSON Schemas.
 * @param {Object} schemas
 * @param {Object} [schemas.body] Schema for req.body
 * @param {Object} [schemas.query] Schema for req.query
 * @param {Object} [schemas.params] Schema for req.params
 */
function validateSchema(schemas = {}) {
  const compiledBody = schemas.body ? ajv.compile(schemas.body) : null;
  const compiledQuery = schemas.query ? ajv.compile(schemas.query) : null;
  const compiledParams = schemas.params ? ajv.compile(schemas.params) : null;

  return (req, res, next) => {
    const details = [];

    if (compiledBody && !compiledBody(req.body)) {
      compiledBody.errors.forEach((err) => {
        const field = err.instancePath ? err.instancePath.replace(/^\//, '') : err.params?.missingProperty || 'body';
        details.push({
          location: 'body',
          field,
          message: err.message,
        });
      });
    }

    if (compiledQuery && !compiledQuery(req.query)) {
      compiledQuery.errors.forEach((err) => {
        const field = err.instancePath ? err.instancePath.replace(/^\//, '') : err.params?.missingProperty || 'query';
        details.push({
          location: 'query',
          field,
          message: err.message,
        });
      });
    }

    if (compiledParams && !compiledParams(req.params)) {
      compiledParams.errors.forEach((err) => {
        const field = err.instancePath ? err.instancePath.replace(/^\//, '') : err.params?.missingProperty || 'params';
        details.push({
          location: 'params',
          field,
          message: err.message,
        });
      });
    }

    if (details.length > 0) {
      return next(
        new AppError(
          400,
          'INVALID_INPUT',
          'Request schema validation failed. Please check field requirements.',
          details
        )
      );
    }

    next();
  };
}

module.exports = {
  validateSchema,
  ajv,
};
