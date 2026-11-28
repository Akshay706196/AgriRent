const paymentService = require('../services/payment.service');
const asyncHandler = require('../utils/asyncHandler');

const handleGatewayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] || req.headers['x-gateway-signature'];
  const result = await paymentService.handleGatewayWebhook({
    signature,
    body: req.body,
    rawBody: req.rawBody,
    correlationId: req.correlationId,
  });

  res.status(200).json(result);
});

module.exports = {
  handleGatewayWebhook,
};
