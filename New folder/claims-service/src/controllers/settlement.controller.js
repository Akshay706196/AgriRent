const asyncHandler = require('../utils/asyncHandler');
const settlementSagaService = require('../services/settlementSaga.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');

const waiveClaims = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const correlationId = req.correlationId;

  const result = await settlementSagaService.waiveClaimWindow({
    bookingId,
    user: req.user,
    correlationId,
  });

  res.status(200).json(result);
});

const getApprovedDeductions = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const result = await settlementSagaService.getApprovedDeductions(bookingId);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.status(200).json(result);
});

const requestSettlement = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const correlationId = req.correlationId;

  const result = await settlementSagaService.requestSettlement({
    bookingId,
    user: req.user,
    correlationId,
  });

  res.status(202).json(result);
});

const getSettlementStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const correlationId = req.correlationId;

  const result = await settlementSagaService.getSettlementStatus(bookingId, req.user, correlationId);

  // ETag + 304 handling
  if (handleETag(req, res, result)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, result, 'settlementStatus');
});

module.exports = {
  waiveClaims,
  getApprovedDeductions,
  requestSettlement,
  getSettlementStatus,
};
