const asyncHandler = require('../utils/asyncHandler');
const { lateFineService } = require('../services/lateFine.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');
const bookingClient = require('../clients/booking.client');
const AppError = require('../utils/AppError');

const getLateFine = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { returnTime } = req.query;
  const correlationId = req.correlationId;

  // Authorization check: participant or admin
  const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
  const isParticipant = req.user && (req.user.id === booking.renterId || req.user.id === booking.ownerId);
  const isAdminOrService = req.user && (req.user.role === 'ADMIN' || req.user.isService);

  if (!isParticipant && !isAdminOrService) {
    throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view the late fine assessment for this booking.');
  }

  const result = await lateFineService.getOrCalculateLateFine(bookingId, returnTime, booking);

  // If dynamic preview calculation, set no-store Cache-Control
  if (result.preview) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  } else {
    // Persisted fine: supports ETag and 304
    res.setHeader('Cache-Control', 'private, no-cache');
    if (handleETag(req, res, result)) {
      return;
    }
  }

  sendNegotiatedResponse(req, res, 200, result, 'lateFine');
});

module.exports = {
  getLateFine,
};
