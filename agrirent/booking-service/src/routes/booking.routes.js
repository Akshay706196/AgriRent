const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { requireAuth, requireKyc, requireServiceAuth } = require('../middleware/auth.middleware');
const {
  createBookingValidator,
  rejectBookingValidator,
  cancelBookingValidator,
  availabilityQueryValidator,
} = require('../validators/booking.validator');

// Create booking request (Renter must be authenticated and KYC verified)
router.post(
  '/',
  requireAuth,
  requireKyc,
  createBookingValidator,
  bookingController.createBooking
);

// Check booking availability for equipment across half-open date interval [startDate, endDate)
router.get(
  '/availability',
  availabilityQueryValidator,
  bookingController.checkAvailability
);

// Get current renter's bookings
router.get('/my-bookings', requireAuth, bookingController.getMyBookings);

// Get booking requests for equipment owned by current user
router.get('/owner/requests', requireAuth, bookingController.getOwnerRequests);

// Internal service-to-service endpoints for Payment, Handover & Return lifecycle
router.post(
  '/internal/:bookingId/payment-confirmed',
  requireServiceAuth,
  bookingController.confirmPayment
);
router.post(
  '/internal/:bookingId/payment-failed',
  requireServiceAuth,
  bookingController.failPayment
);
router.post(
  '/internal/:bookingId/handover-confirmed',
  requireServiceAuth,
  bookingController.confirmHandover
);
router.post(
  '/:bookingId/handover-confirmations',
  requireServiceAuth,
  bookingController.confirmHandover
);
router.post(
  '/internal/:bookingId/return-confirmed',
  requireServiceAuth,
  bookingController.confirmReturn
);
router.post(
  '/:bookingId/return-confirmations',
  requireServiceAuth,
  bookingController.confirmReturn
);
router.post(
  '/internal/:bookingId/completion-confirmed',
  requireServiceAuth,
  bookingController.confirmCompletion
);
router.post(
  '/:bookingId/completion-confirmations',
  requireServiceAuth,
  bookingController.confirmCompletion
);

// Get specific booking details by bookingId (Authorized participants or internal services)
router.get('/:bookingId', (req, res, next) => {
  const serviceToken =
    req.headers['internal_service_token'] ||
    req.headers['internal-service-token'] ||
    req.headers['x-internal-service-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';
  if (serviceToken && serviceToken === expectedToken) {
    req.user = { id: 'INTERNAL_SERVICE', role: 'ADMIN' };
    return bookingController.getBookingById(req, res, next);
  }
  return requireAuth(req, res, () => bookingController.getBookingById(req, res, next));
});

// Owner approves booking request
router.patch('/:bookingId/approve', requireAuth, bookingController.approveBooking);

// Owner rejects booking request
router.patch(
  '/:bookingId/reject',
  requireAuth,
  rejectBookingValidator,
  bookingController.rejectBooking
);

// Renter or owner cancels eligible booking
router.patch(
  '/:bookingId/cancel',
  requireAuth,
  cancelBookingValidator,
  bookingController.cancelBooking
);

module.exports = router;
