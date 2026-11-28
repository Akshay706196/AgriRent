const asyncHandler = require('../utils/asyncHandler');
const eventService = require('../services/event.service');
const bookingClient = require('../clients/booking.client');
const AppError = require('../utils/AppError');

const listEvents = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { limit, cursor } = req.query;
  const correlationId = req.correlationId;

  // Authorization: owner, renter, or admin only
  const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
  const isParticipant = req.user && (req.user.id === booking.renterId || req.user.id === booking.ownerId);
  const isAdminOrService = req.user && (req.user.role === 'ADMIN' || req.user.isService);

  if (!isParticipant && !isAdminOrService) {
    throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view the event history for this booking.');
  }

  const result = await eventService.listEvents({
    bookingId,
    limit,
    cursor,
  });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/bookings/${encodeURIComponent(bookingId)}/events?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.status(200).json(result);
});

const getConditionReports = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const correlationId = req.correlationId;

  // Authorization: owner, renter, admin, or internal service
  const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
  const isParticipant = req.user && (req.user.id === booking.renterId || req.user.id === booking.ownerId);
  const isAdminOrService = req.user && (req.user.role === 'ADMIN' || req.user.isService);

  if (!isParticipant && !isAdminOrService) {
    throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view condition reports for this booking.');
  }

  const result = await eventService.getConditionReports(bookingId);

  const { handleETag } = require('../middleware/etag.middleware');
  if (handleETag(req, res, result)) {
    return;
  }

  res.setHeader('Cache-Control', 'private, no-cache');
  res.status(200).json(result);
});

module.exports = {
  listEvents,
  getConditionReports,
};
