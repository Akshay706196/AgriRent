const eventService = require('../services/event.service');
const paymentService = require('../services/payment.service');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getPaymentEvents = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { limit, cursor } = req.query;

  // Authorization: admin or participant only
  const payment = await paymentService.getPayment(paymentId);
  if (req.user && req.user.role !== 'ADMIN' && req.user.id !== payment.renterId) {
    throw new AppError(403, 'ACCESS_DENIED', 'Only the participating renter or an administrator can access audit events.');
  }

  const result = await eventService.getPaymentEvents(paymentId, { limit, cursor });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}/events?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

module.exports = {
  getPaymentEvents,
};
