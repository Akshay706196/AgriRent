const depositService = require('../services/deposit.service');
const asyncHandler = require('../utils/asyncHandler');

const holdSecurityDeposit = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await depositService.holdDeposit({
    bookingId,
    depositAmount: req.body.depositAmount,
    paymentReference: req.body.paymentReference,
    user: req.user,
    correlationId: req.correlationId,
  });

  res.status(201).json(result);
});

const getDeposit = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await depositService.getDeposit(bookingId);
  res.status(200).json(result);
});

module.exports = {
  holdSecurityDeposit,
  getDeposit,
};
