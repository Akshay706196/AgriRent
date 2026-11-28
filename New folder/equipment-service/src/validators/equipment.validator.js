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

const createEquipmentValidator = [
  body('name').trim().notEmpty().withMessage('Equipment name is required').isLength({ max: 120 }),
  body('category')
    .trim()
    .toUpperCase()
    .isIn(['TRACTOR', 'HARVESTER', 'ROTAVATOR', 'SEEDER', 'OTHER'])
    .withMessage('Category must be TRACTOR, HARVESTER, ROTAVATOR, SEEDER, or OTHER'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 2000 }),
  body('brand').optional().trim().isLength({ max: 80 }),
  body('model').optional().trim().isLength({ max: 80 }),
  body('manufacturingYear')
    .optional()
    .isInt({ min: 1950, max: new Date().getFullYear() + 1 })
    .withMessage('Valid manufacturing year is required'),
  body('condition')
    .trim()
    .toUpperCase()
    .isIn(['NEW', 'GOOD', 'FAIR'])
    .withMessage('Condition must be NEW, GOOD, or FAIR'),
  body('photos').optional().isArray().withMessage('Photos must be an array of URLs'),
  body('pricePerDay').isFloat({ gt: 0 }).withMessage('pricePerDay must be a number greater than 0'),
  body('securityDeposit').isFloat({ min: 0 }).withMessage('securityDeposit must be a number greater than or equal to 0'),
  body('pickupAddress.address').trim().notEmpty().withMessage('Pickup street address is required'),
  body('pickupAddress.city').trim().notEmpty().withMessage('Pickup city is required'),
  body('pickupAddress.state').trim().notEmpty().withMessage('Pickup state is required'),
  body('pickupAddress.postalCode').trim().notEmpty().withMessage('Pickup postal code is required'),
  body('location.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be [longitude, latitude]'),
  body('status')
    .optional()
    .toUpperCase()
    .isIn(['DRAFT', 'ACTIVE', 'AVAILABLE'])
    .withMessage('Initial status must be DRAFT or ACTIVE'),
  handleValidationErrors,
];

const updateEquipmentValidator = [
  body('name').optional().trim().notEmpty().withMessage('Equipment name cannot be empty'),
  body('title').optional().trim().notEmpty().withMessage('Equipment title cannot be empty'),
  body('category')
    .optional()
    .trim()
    .toUpperCase()
    .isIn(['TRACTOR', 'HARVESTER', 'ROTAVATOR', 'SEEDER', 'SEED_DRILL', 'SPRAYER', 'TILLER', 'OTHER']),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('condition')
    .optional()
    .trim()
    .toUpperCase()
    .isIn(['NEW', 'GOOD', 'FAIR', 'EXCELLENT']),
  body('pricePerDay').optional().isFloat({ gt: 0 }).withMessage('pricePerDay must be greater than 0'),
  body('securityDeposit').optional().isFloat({ min: 0 }).withMessage('securityDeposit must be 0 or greater'),
  body('status')
    .optional()
    .toUpperCase()
    .isIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'AVAILABLE', 'UNDER_MAINTENANCE'])
    .withMessage('Invalid status'),
  body('ownerId').optional().custom((val) => {
    throw new Error('Changing ownerId is not permitted');
  }),
  body('equipmentId').optional().custom((val) => {
    throw new Error('Changing equipmentId is not permitted');
  }),
  handleValidationErrors,
];

const availabilityQueryValidator = [
  query('startDate')
    .isISO8601()
    .withMessage('startDate must be a valid ISO8601 date (YYYY-MM-DD)'),
  query('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 date (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.query.startDate)) {
        throw new Error('endDate must be strictly later than startDate');
      }
      return true;
    }),
  handleValidationErrors,
];

module.exports = {
  createEquipmentValidator,
  updateEquipmentValidator,
  availabilityQueryValidator,
};
