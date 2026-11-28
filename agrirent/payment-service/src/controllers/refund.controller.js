const refundService = require('../services/refund.service');
const asyncHandler = require('../utils/asyncHandler');

const refundPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const result = await refundService.processRefund({
    paymentId,
    amount: req.body.amount,
    reason: req.body.reason,
    idempotencyKey: req.idempotencyKey || req.headers['idempotency-key'],
    user: req.user,
    correlationId: req.correlationId,
  });

  res.status(201).json(result);
});

module.exports = {
  refundPayment,
};
