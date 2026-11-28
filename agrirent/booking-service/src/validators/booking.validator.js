const { body, query, validationResult } = require('express-validator');
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

const createBookingValidator = [
  body('equipmentId').trim().notEmpty().withMessage('equipmentId is required'),
  body('startDate')
    .isISO8601()
    .withMessage('startDate must be a valid date in ISO8601 format (YYYY-MM-DD)'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid date in ISO8601 format (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('endDate must be strictly later than startDate');
      }
      return true;
    }),
  handleValidationErrors,
];

const rejectBookingValidator = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Rejection reason cannot exceed 500 characters'),
  handleValidationErrors,
];

const cancelBookingValidator = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Cancellation reason cannot exceed 500 characters'),
  handleValidationErrors,
];

const availabilityQueryValidator = [
  query('equipmentId').trim().notEmpty().withMessage('equipmentId query parameter is required'),
  query('startDate').isISO8601().withMessage('startDate must be a valid ISO8601 date'),
  query('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 date')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.query.startDate)) {
        throw new Error('endDate must be strictly later than startDate');
      }
      return true;
    }),
  handleValidationErrors,
];

module.exports = {
  createBookingValidator,
  rejectBookingValidator,
  cancelBookingValidator,
  availabilityQueryValidator,
};
