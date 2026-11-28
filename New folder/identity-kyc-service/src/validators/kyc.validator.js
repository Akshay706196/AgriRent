const { body } = require('express-validator');
const handleValidationErrors = require('../middleware/validate.middleware');

const validateSubmitKyc = [
  body('documentType')
    .trim()
    .toUpperCase()
    .isIn([
      'GOVERNMENT_ID',
      'AADHAAR',
      'PAN',
      'DRIVING_LICENSE',
      'PASSPORT',
      'VOTER_ID',
      'FARMER_ID',
    ])
    .withMessage(
      'documentType must be one of: GOVERNMENT_ID, AADHAAR, PAN, DRIVING_LICENSE, PASSPORT, VOTER_ID, FARMER_ID'
    ),
  body('documentReference')
    .trim()
    .notEmpty()
    .withMessage('documentReference is required')
    .isLength({ min: 3, max: 255 })
    .withMessage('documentReference must be between 3 and 255 characters'),
  body('status').custom((val) => {
    if (val !== undefined) throw new Error('Client cannot set status');
    return true;
  }),
  body('reviewedBy').custom((val) => {
    if (val !== undefined) throw new Error('Client cannot set reviewedBy');
    return true;
  }),
  body('userId').custom((val) => {
    if (val !== undefined) throw new Error('Client cannot specify userId');
    return true;
  }),
  handleValidationErrors,
];

const validateRejectKyc = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('A non-empty rejection reason is required')
    .isLength({ max: 500 })
    .withMessage('Rejection reason cannot exceed 500 characters'),
  handleValidationErrors,
];

module.exports = {
  validateSubmitKyc,
  validateRejectKyc,
};
