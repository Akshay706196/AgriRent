const { body } = require('express-validator');
const handleValidationErrors = require('../middleware/validate.middleware');

const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s0-9]{7,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('email').custom((value) => {
    if (value !== undefined) throw new Error('Changing email directly via profile update is not allowed');
    return true;
  }),
  body('roles').custom((value) => {
    if (value !== undefined) throw new Error('Modifying roles is forbidden');
    return true;
  }),
  body('accountStatus').custom((value) => {
    if (value !== undefined) throw new Error('Modifying accountStatus is forbidden');
    return true;
  }),
  body('kycStatus').custom((value) => {
    if (value !== undefined) throw new Error('Modifying kycStatus is forbidden');
    return true;
  }),
  body('userId').custom((value) => {
    if (value !== undefined) throw new Error('Modifying userId is forbidden');
    return true;
  }),
  handleValidationErrors,
];

module.exports = {
  validateUpdateProfile,
};
