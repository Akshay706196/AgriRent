const { body } = require('express-validator');
const handleValidationErrors = require('../middleware/validate.middleware');

const validateSuspendUser = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  handleValidationErrors,
];

const validateBlockUser = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  handleValidationErrors,
];

module.exports = {
  validateSuspendUser,
  validateBlockUser,
};
