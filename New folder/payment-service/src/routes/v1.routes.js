const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const depositController = require('../controllers/deposit.controller');
const refundController = require('../controllers/refund.controller');
const settlementController = require('../controllers/settlement.controller');
const webhookController = require('../controllers/webhook.controller');
const eventController = require('../controllers/event.controller');

const { requireAuth, requireKyc, requireAdminOrService } = require('../middleware/auth.middleware');
const { requireIdempotency } = require('../middleware/idempotency.middleware');
const { validateSchema } = require('../middleware/validator.middleware');
const { requireContentNegotiation } = require('../middleware/contentNegotiation.middleware');
const { privateNoCache, privateMustRevalidate, noStore } = require('../middleware/cacheControl.middleware');
const { strictLimiter, generalLimiter } = require('../middleware/rateLimit.middleware');

const schemas = require('../schemas/payment.schemas');

// 1. InitiatePayment - POST /v1/payments
router.post(
  '/payments',
  strictLimiter,
  requireAuth,
  requireKyc,
  requireIdempotency({ required: true }),
  validateSchema(schemas.initiatePaymentSchema),
  paymentController.initiatePayment
);

// 2. VerifyPayment - POST /v1/payments/:paymentId/verifications
router.post(
  '/payments/:paymentId/verifications',
  strictLimiter,
  requireAuth,
  validateSchema(schemas.verifyPaymentSchema),
  paymentController.verifyPayment
);

// 3. Gateway Webhook - POST /v1/webhooks/gateway
router.post(
  '/webhooks/gateway',
  webhookController.handleGatewayWebhook
);

// 4. GetPayment - GET /v1/payments/:paymentId
router.get(
  '/payments/:paymentId',
  generalLimiter,
  requireAuth,
  requireContentNegotiation,
  privateNoCache, // Deliberate cache policy: financial records require revalidation
  paymentController.getPayment
);

// 5. ListPayments - GET /v1/payments
router.get(
  '/payments',
  generalLimiter,
  requireAuth,
  privateNoCache,
  validateSchema(schemas.listPaymentsSchema),
  paymentController.listPayments
);

// 6. GetPaymentStatus - GET /v1/bookings/:bookingId/payment-status
router.get(
  '/bookings/:bookingId/payment-status',
  generalLimiter,
  requireContentNegotiation,
  privateMustRevalidate, // Polling status changes fast; must revalidate
  paymentController.getPaymentStatus
);

// 7. HoldSecurityDeposit - POST /v1/bookings/:bookingId/deposit-holds
router.post(
  '/bookings/:bookingId/deposit-holds',
  generalLimiter,
  requireAuth,
  validateSchema(schemas.holdDepositSchema),
  depositController.holdSecurityDeposit
);

// 8. RefundPayment - POST /v1/payments/:paymentId/refunds
router.post(
  '/payments/:paymentId/refunds',
  generalLimiter,
  requireAdminOrService,
  requireIdempotency({ required: true, conflictOnReuse: true, duplicateCode: 'DUPLICATE_REFUND' }),
  validateSchema(schemas.refundPaymentSchema),
  refundController.refundPayment
);

// 9. SettlePayment - POST /v1/bookings/:bookingId/settlements
router.post(
  '/bookings/:bookingId/settlements',
  generalLimiter,
  requireAdminOrService,
  requireIdempotency({ required: true }),
  validateSchema(schemas.settlePaymentSchema),
  settlementController.settlePayment
);

// 10. GetSettlement - GET /v1/bookings/:bookingId/settlements/:settlementId
router.get(
  '/bookings/:bookingId/settlements/:settlementId',
  generalLimiter,
  requireAuth,
  requireContentNegotiation,
  privateNoCache,
  settlementController.getSettlement
);

// 11. GetPaymentEvents - GET /v1/payments/:paymentId/events
router.get(
  '/payments/:paymentId/events',
  generalLimiter,
  requireAuth,
  noStore, // Security audit trail should never be cached
  validateSchema(schemas.getEventsSchema),
  eventController.getPaymentEvents
);

// 12. GetApprovedDeductions (Contract with Claims Service) - GET /v1/settlements/booking/:bookingId/deductions
router.get(
  '/settlements/booking/:bookingId/deductions',
  generalLimiter,
  settlementController.getApprovedDeductions
);

module.exports = router;
