const paymentService = require('../services/payment.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');
const asyncHandler = require('../utils/asyncHandler');

const initiatePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.initiatePayment({
    bookingId: req.body.bookingId,
    renterId: req.body.renterId,
    rentalAmount: req.body.rentalAmount,
    deposit: req.body.deposit,
    currency: req.body.currency,
    user: req.user,
    correlationId: req.correlationId,
  });

  res.status(201).json(result);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const result = await paymentService.verifyPayment({
    paymentId,
    gatewayTransactionReference: req.body.gatewayTransactionReference || req.body.transactionReference,
    gatewayOrderId: req.body.gatewayOrderId,
    signature: req.body.signature,
    actor: req.user?.id || 'renter',
    correlationId: req.correlationId,
  });

  res.status(200).json(result);
});

const getPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const payment = await paymentService.getPayment(paymentId);

  // ETag + 304 Not Modified support
  if (handleETag(req, res, payment)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, payment, 'payment');
});

const listPayments = asyncHandler(async (req, res) => {
  const { bookingId, status, limit, cursor } = req.query;
  const result = await paymentService.listPayments({ bookingId, status, limit, cursor });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/v1/payments?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}${bookingId ? `&bookingId=${bookingId}` : ''}${status ? `&status=${status}` : ''}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

const getPaymentStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const status = await paymentService.getPaymentStatus(bookingId);

  sendNegotiatedResponse(req, res, 200, status, 'paymentStatus');
});

module.exports = {
  initiatePayment,
  verifyPayment,
  getPayment,
  listPayments,
  getPaymentStatus,
};
