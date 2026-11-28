const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return next(new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed', formattedErrors));
  }
  next();
};

module.exports = handleValidationErrors;
