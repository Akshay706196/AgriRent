const asyncHandler = require('../utils/asyncHandler');
const returnService = require('../services/return.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');
const bookingClient = require('../clients/booking.client');
const AppError = require('../utils/AppError');

const verifyReturn = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { pin, conditionReport } = req.body;
  const correlationId = req.correlationId;

  const result = await returnService.verifyReturn({
    bookingId,
    pin,
    conditionReport,
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

const getReturn = asyncHandler(async (req, res) => {
  const { bookingId, returnId } = req.params;
  const correlationId = req.correlationId;

  // Authorization check: participant or admin
  const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
  const isParticipant = req.user && (req.user.id === booking.renterId || req.user.id === booking.ownerId);
  const isAdminOrService = req.user && (req.user.role === 'ADMIN' || req.user.isService);

  if (!isParticipant && !isAdminOrService) {
    throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view this return record.');
  }

  const returnRecord = await returnService.getReturn(bookingId, returnId);

  // ETag + 304 handling
  if (handleETag(req, res, returnRecord)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, returnRecord, 'return');
});

module.exports = {
  verifyReturn,
  getReturn,
};
