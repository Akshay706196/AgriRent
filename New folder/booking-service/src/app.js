const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const bookingRoutes = require('./routes/booking.routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Correlation ID tracing middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `req-${crypto.randomUUID()}`;
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'agrirent-booking-service',
    timestamp: new Date().toISOString(),
  });
});

// Mount Booking API routes
app.use('/api/v1/bookings', bookingRoutes);

// Direct mount for Step 5 contract: /internal/bookings/:bookingId/payment-confirmed
const bookingController = require('./controllers/booking.controller');
const { requireServiceAuth } = require('./middleware/auth.middleware');
app.post('/internal/bookings/:bookingId/payment-confirmed', requireServiceAuth, bookingController.confirmPayment);
app.post('/internal/bookings/:bookingId/payment-failed', requireServiceAuth, bookingController.failPayment);
app.post('/internal/bookings/:bookingId/handover-confirmed', requireServiceAuth, bookingController.confirmHandover);
app.post('/internal/bookings/:bookingId/return-confirmed', requireServiceAuth, bookingController.confirmReturn);
app.post('/v1/bookings/:bookingId/handover-confirmations', requireServiceAuth, bookingController.confirmHandover);
app.post('/v1/bookings/:bookingId/return-confirmations', requireServiceAuth, bookingController.confirmReturn);
app.get('/internal/bookings/:bookingId', requireServiceAuth, (req, res, next) => {
  req.user = { id: 'INTERNAL_SERVICE', role: 'ADMIN' };
  bookingController.getBookingById(req, res, next);
});

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
