const { body } = require('express-validator');
const handleValidationErrors = require('../middleware/validate.middleware');

const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s0-9]{7,15}$/)
    .withMessage('Please provide a valid phone number (minimum 10 digits)'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  // Reject untrusted fields
  body('roles').custom((value) => {
    if (value !== undefined) throw new Error('Client cannot assign roles');
    return true;
  }),
  body('accountStatus').custom((value) => {
    if (value !== undefined) throw new Error('Client cannot set accountStatus');
    return true;
  }),
  body('kycStatus').custom((value) => {
    if (value !== undefined) throw new Error('Client cannot set kycStatus');
    return true;
  }),
  body('userId').custom((value) => {
    if (value !== undefined) throw new Error('Client cannot provide userId');
    return true;
  }),
  handleValidationErrors,
];

const validateLogin = [
  body('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
};
