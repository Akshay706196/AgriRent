const asyncHandler = require('../utils/asyncHandler');
const disputeService = require('../services/dispute.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');

const raiseDispute = asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const { reason, evidence } = req.body;
  const correlationId = req.correlationId;

  const result = await disputeService.raiseDispute({
    claimId,
    user: req.user,
    reason,
    evidence,
    correlationId,
  });

  res.status(201).json(result);
});

const getDisputeStatus = asyncHandler(async (req, res) => {
  const { disputeId } = req.params;
  const correlationId = req.correlationId;

  const result = await disputeService.getDispute(disputeId, req.user, correlationId);

  // ETag + 304 handling
  if (handleETag(req, res, result)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, result, 'dispute');
});

const listDisputes = asyncHandler(async (req, res) => {
  const { claimId, status, limit, cursor } = req.query;

  const result = await disputeService.listDisputes({
    claimId,
    status,
    limit,
    cursor,
    user: req.user,
  });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/disputes?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}${claimId ? `&claimId=${claimId}` : ''}${status ? `&status=${status}` : ''}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

module.exports = {
  raiseDispute,
  getDisputeStatus,
  listDisputes,
};
