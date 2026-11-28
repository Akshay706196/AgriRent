const asyncHandler = require('../utils/asyncHandler');
const claimService = require('../services/claim.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');

const submitClaim = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason, claimedAmount, evidence, claimantId: bodyClaimantId } = req.body;
  const claimantId = req.user.id;
  const correlationId = req.correlationId;

  const result = await claimService.submitDamageClaim({
    bookingId,
    claimantId,
    reason,
    claimedAmount,
    evidence,
    bodyClaimantId,
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

const getClaim = asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const correlationId = req.correlationId;

  const result = await claimService.getClaim(claimId, req.user, correlationId);

  // ETag + 304 handling
  if (handleETag(req, res, result)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, result, 'claim');
});

const listClaims = asyncHandler(async (req, res) => {
  const { bookingId, status, limit, cursor } = req.query;

  const result = await claimService.listClaims({
    bookingId,
    status,
    limit,
    cursor,
    user: req.user,
  });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/claims?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}${bookingId ? `&bookingId=${bookingId}` : ''}${status ? `&status=${status}` : ''}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

const addEvidenceItem = asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const { photos, notes } = req.body;
  const correlationId = req.correlationId;

  const result = await claimService.addEvidenceItem({
    claimId,
    photos,
    notes,
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

const getClaimEvents = asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const { limit, cursor } = req.query;
  const correlationId = req.correlationId;

  const result = await claimService.getClaimEvents(claimId, {
    limit,
    cursor,
    user: req.user,
    correlationId,
  });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/claims/${encodeURIComponent(claimId)}/events?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

module.exports = {
  submitClaim,
  getClaim,
  listClaims,
  addEvidenceItem,
  getClaimEvents,
};
