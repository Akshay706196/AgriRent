const settlementService = require('../services/settlement.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');
const asyncHandler = require('../utils/asyncHandler');

const settlePayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await settlementService.settleBooking({
    bookingId,
    rentalAmount: req.body.rentalAmount,
    lateFine: req.body.lateFine,
    damageDeduction: req.body.damageDeduction,
    disputedAmount: req.body.disputedAmount,
    user: req.user,
    correlationId: req.correlationId,
  });

  res.status(201).json(result);
});

const getSettlement = asyncHandler(async (req, res) => {
  const { bookingId, settlementId } = req.params;
  const settlement = await settlementService.getSettlement(bookingId, settlementId);

  // ETag + 304 Not Modified
  if (handleETag(req, res, settlement)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, settlement, 'settlement');
});

const getApprovedDeductions = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const deductions = await settlementService.getApprovedDeductions(bookingId, req.correlationId);
  res.status(200).json({ bookingId, deductions });
});

module.exports = {
  settlePayment,
  getSettlement,
  getApprovedDeductions,
};
