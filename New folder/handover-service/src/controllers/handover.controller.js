const asyncHandler = require('../utils/asyncHandler');
const handoverService = require('../services/handover.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');
const bookingClient = require('../clients/booking.client');
const AppError = require('../utils/AppError');

const verifyHandover = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { pin, conditionReport } = req.body;
  const correlationId = req.correlationId;

  const result = await handoverService.verifyHandover({
    bookingId,
    pin,
    conditionReport,
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

const getHandover = asyncHandler(async (req, res) => {
  const { bookingId, handoverId } = req.params;
  const correlationId = req.correlationId;

  // Authorization check: participant or admin
  const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
  const isParticipant = req.user && (req.user.id === booking.renterId || req.user.id === booking.ownerId);
  const isAdminOrService = req.user && (req.user.role === 'ADMIN' || req.user.isService);

  if (!isParticipant && !isAdminOrService) {
    throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view this handover record.');
  }

  const handover = await handoverService.getHandover(bookingId, handoverId);

  // ETag + 304 handling
  if (handleETag(req, res, handover)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, handover, 'handover');
});

const listHandovers = asyncHandler(async (req, res) => {
  const { bookingId, status, limit, cursor } = req.query;

  const result = await handoverService.listHandovers({
    bookingId,
    status,
    limit,
    cursor,
  });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/handovers?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}${bookingId ? `&bookingId=${bookingId}` : ''}${status ? `&status=${status}` : ''}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

module.exports = {
  verifyHandover,
  getHandover,
  listHandovers,
};
