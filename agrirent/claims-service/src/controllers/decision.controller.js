const asyncHandler = require('../utils/asyncHandler');
const decisionService = require('../services/decision.service');

const reviewDamageClaim = asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const { decision, approvedAmount, reason } = req.body;
  const correlationId = req.correlationId;

  const result = await decisionService.reviewDamageClaim({
    claimId,
    decision,
    approvedAmount,
    reason,
    adminUser: req.user,
    correlationId,
  });

  res.status(200).json(result);
});

module.exports = {
  reviewDamageClaim,
};
