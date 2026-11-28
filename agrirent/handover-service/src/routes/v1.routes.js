const express = require('express');
const router = express.Router();

const pinController = require('../controllers/pin.controller');
const handoverController = require('../controllers/handover.controller');
const returnController = require('../controllers/return.controller');
const lateFineController = require('../controllers/lateFine.controller');
const eventController = require('../controllers/event.controller');

const { requireAuth, requireKyc } = require('../middleware/auth.middleware');
const { requireIdempotency } = require('../middleware/idempotency.middleware');
const { validateSchema } = require('../middleware/validator.middleware');
const { requireContentNegotiation } = require('../middleware/contentNegotiation.middleware');
const { privateNoCache, privateMustRevalidate } = require('../middleware/cacheControl.middleware');
const { pinGenLimiter, pinVerifyLimiter } = require('../middleware/rateLimit.middleware');

const {
  generatePinSchema,
  verifyPinSchema,
  lateFineSchema,
  getHandoverSchema,
  getReturnSchema,
  listHandoversSchema,
  listEventsSchema,
} = require('../schemas/handover.schemas');

// 1. PIN Generation Operations (Renter action)
router.post(
  '/bookings/:bookingId/handover-pins',
  requireAuth,
  requireKyc,
  pinGenLimiter,
  requireIdempotency(),
  validateSchema(generatePinSchema),
  pinController.generateHandoverPin
);

router.post(
  '/bookings/:bookingId/return-pins',
  requireAuth,
  requireKyc,
  pinGenLimiter,
  requireIdempotency(),
  validateSchema(generatePinSchema),
  pinController.generateReturnPin
);

// 2. Handover & Return Verification Operations (Owner action)
router.post(
  '/bookings/:bookingId/handovers',
  requireAuth,
  requireKyc,
  pinVerifyLimiter,
  requireIdempotency(),
  validateSchema(verifyPinSchema),
  handoverController.verifyHandover
);

router.post(
  '/bookings/:bookingId/returns',
  requireAuth,
  requireKyc,
  pinVerifyLimiter,
  requireIdempotency(),
  validateSchema(verifyPinSchema),
  returnController.verifyReturn
);

// 3. Late Fine Calculation (Stored calculation & dynamic preview)
router.get(
  '/bookings/:bookingId/late-fine',
  requireAuth,
  requireContentNegotiation,
  validateSchema(lateFineSchema),
  lateFineController.getLateFine
);

// 4. Detail Retrieval (Supports ETag + XML negotiation)
router.get(
  '/bookings/:bookingId/handovers/:handoverId',
  requireAuth,
  privateNoCache,
  requireContentNegotiation,
  validateSchema(getHandoverSchema),
  handoverController.getHandover
);

router.get(
  '/bookings/:bookingId/returns/:returnId',
  requireAuth,
  privateNoCache,
  requireContentNegotiation,
  validateSchema(getReturnSchema),
  returnController.getReturn
);

// 5. Cursor-Paginated Collections
router.get(
  '/handovers',
  requireAuth,
  privateMustRevalidate,
  validateSchema(listHandoversSchema),
  handoverController.listHandovers
);

router.get(
  '/bookings/:bookingId/events',
  requireAuth,
  privateMustRevalidate,
  validateSchema(listEventsSchema),
  eventController.listEvents
);

// 6. Condition Reports Snapshot for Claims Service
router.get(
  '/bookings/:bookingId/condition-reports',
  requireAuth,
  privateNoCache,
  validateSchema(generatePinSchema), // Validates bookingId in params
  eventController.getConditionReports
);

module.exports = router;
