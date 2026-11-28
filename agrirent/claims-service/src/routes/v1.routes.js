const express = require('express');
const router = express.Router();

const claimController = require('../controllers/claim.controller');
const disputeController = require('../controllers/dispute.controller');
const decisionController = require('../controllers/decision.controller');
const reviewController = require('../controllers/review.controller');
const settlementController = require('../controllers/settlement.controller');

const {
  requireAuth,
  requireKyc,
  requireAdmin,
  requireAdminOrService,
  requireServiceToken,
} = require('../middleware/auth.middleware');
const { requireIdempotency } = require('../middleware/idempotency.middleware');
const { validateSchema } = require('../middleware/validator.middleware');
const { requireContentNegotiation } = require('../middleware/contentNegotiation.middleware');
const {
  privateNoCache,
  privateShortCache,
  privateMustRevalidate,
  noStore,
} = require('../middleware/cacheControl.middleware');
const { strictCreationLimiter, generalLimiter } = require('../middleware/rateLimit.middleware');

const schemas = require('../schemas/claims.schemas');

// ==============================================================================
// 1. DAMAGE CLAIMS
// ==============================================================================

// SubmitDamageClaim - POST /v1/bookings/:bookingId/claims
router.post(
  '/bookings/:bookingId/claims',
  strictCreationLimiter,
  requireAuth,
  requireKyc,
  requireIdempotency({ required: true }),
  validateSchema(schemas.submitClaimSchema, 'INVALID_CLAIM'),
  claimController.submitClaim
);

// GetClaim - GET /v1/claims/:claimId
router.get(
  '/claims/:claimId',
  generalLimiter,
  requireAuth,
  privateNoCache, // Deliberate: mutable claim record with ETag
  requireContentNegotiation,
  validateSchema(schemas.claimIdParamSchema),
  claimController.getClaim
);

// ListClaims - GET /v1/claims
router.get(
  '/claims',
  generalLimiter,
  requireAuth,
  privateNoCache,
  validateSchema(schemas.listClaimsSchema),
  claimController.listClaims
);

// AddEvidenceItem - POST /v1/claims/:claimId/evidence-items
router.post(
  '/claims/:claimId/evidence-items',
  generalLimiter,
  requireAuth,
  requireIdempotency({ required: true }),
  validateSchema(schemas.addEvidenceSchema),
  claimController.addEvidenceItem
);

// GetClaimEvents - GET /v1/claims/:claimId/events
router.get(
  '/claims/:claimId/events',
  generalLimiter,
  requireAuth,
  privateMustRevalidate,
  validateSchema(schemas.claimIdParamSchema),
  claimController.getClaimEvents
);

// ==============================================================================
// 2. DISPUTES
// ==============================================================================

// RaiseDispute - POST /v1/claims/:claimId/disputes
router.post(
  '/claims/:claimId/disputes',
  strictCreationLimiter,
  requireAuth,
  requireKyc,
  requireIdempotency({ required: true }),
  validateSchema(schemas.raiseDisputeSchema),
  disputeController.raiseDispute
);

// GetDisputeStatus - GET /v1/disputes/:disputeId
router.get(
  '/disputes/:disputeId',
  generalLimiter,
  requireAuth,
  privateNoCache,
  requireContentNegotiation,
  validateSchema(schemas.disputeIdParamSchema),
  disputeController.getDisputeStatus
);

// ListDisputes - GET /v1/disputes
router.get(
  '/disputes',
  generalLimiter,
  requireAuth,
  privateNoCache,
  validateSchema(schemas.listDisputesSchema),
  disputeController.listDisputes
);

// ==============================================================================
// 3. DECISIONS (Admin)
// ==============================================================================

// ReviewDamageClaim - POST /v1/claims/:claimId/decisions
router.post(
  '/claims/:claimId/decisions',
  generalLimiter,
  requireAuth,
  requireAdmin,
  requireIdempotency({ required: true }),
  validateSchema(schemas.reviewClaimDecisionSchema),
  decisionController.reviewDamageClaim
);

// ==============================================================================
// 4. REVIEWS
// ==============================================================================

// SubmitReview - POST /v1/bookings/:bookingId/reviews
router.post(
  '/bookings/:bookingId/reviews',
  strictCreationLimiter,
  requireAuth,
  requireKyc,
  requireIdempotency({ required: true }),
  validateSchema(schemas.submitReviewSchema),
  reviewController.submitReview
);

// ListReviews - GET /v1/reviews
router.get(
  '/reviews',
  generalLimiter,
  requireAuth,
  privateShortCache, // Deliberate: public peer reviews can tolerate 60s cache
  validateSchema(schemas.listReviewsSchema),
  reviewController.listReviews
);

// GetReview - GET /v1/reviews/:reviewId
router.get(
  '/reviews/:reviewId',
  generalLimiter,
  requireAuth,
  privateNoCache,
  requireContentNegotiation,
  validateSchema(schemas.reviewIdParamSchema),
  reviewController.getReview
);

// GetReviewSummary - GET /v1/users/:userId/review-summary
router.get(
  '/users/:userId/review-summary',
  generalLimiter,
  requireAuth,
  privateNoCache,
  requireContentNegotiation,
  validateSchema(schemas.userIdParamSchema),
  reviewController.getReviewSummary
);

// ==============================================================================
// 5. SETTLEMENT HAND-OFF & WAIVERS
// ==============================================================================

// ClaimWaiver - POST /v1/bookings/:bookingId/claim-waivers
router.post(
  '/bookings/:bookingId/claim-waivers',
  generalLimiter,
  requireAuth,
  requireIdempotency({ required: true }),
  validateSchema(schemas.bookingIdParamSchema),
  settlementController.waiveClaims
);

// GetApprovedDeductions (Payment Service contract) - GET /v1/bookings/:bookingId/approved-deductions
router.get(
  '/bookings/:bookingId/approved-deductions',
  generalLimiter,
  requireServiceToken,
  noStore, // Deliberate: financial deduction consumed by Payment, never cached
  validateSchema(schemas.bookingIdParamSchema),
  settlementController.getApprovedDeductions
);

// SettlementRequest - POST /v1/bookings/:bookingId/settlement-requests
router.post(
  '/bookings/:bookingId/settlement-requests',
  generalLimiter,
  requireAdminOrService,
  requireIdempotency({ required: true }),
  validateSchema(schemas.bookingIdParamSchema),
  settlementController.requestSettlement
);

// GetSettlementStatus - GET /v1/bookings/:bookingId/settlement-status
router.get(
  '/bookings/:bookingId/settlement-status',
  generalLimiter,
  requireAuth,
  privateNoCache,
  requireContentNegotiation,
  validateSchema(schemas.bookingIdParamSchema),
  settlementController.getSettlementStatus
);

module.exports = router;
