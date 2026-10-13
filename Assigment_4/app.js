'use strict';
const express = require('express');
const { randomUUID } = require('node:crypto');
const { BookingStore } = require('./store');
const { validateCreateBooking } = require('./models');
const { problem } = require('./errors');
const { getEquipment } = require('./dependency');

function createApp(options = {}) {
  const app = express();
  const store = options.store || new BookingStore();
  const equipmentLookup = options.equipmentLookup || getEquipment;
  app.use(express.json({ limit: '100kb', strict: true }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'agrirent-booking-service' }));

  // Filtered list: GET /bookings?status=PENDING_OWNER_APPROVAL
  app.get('/bookings', (req, res) => {
    const allowed = ['PENDING_OWNER_APPROVAL', 'CANCELLED_BY_RENTER'];
    const status = req.query.status;
    if (status && !allowed.includes(status)) return problem(res, 400, 'Invalid query parameter', `status must be one of: ${allowed.join(', ')}.`);
    return res.status(200).json({ items: store.list(status).map(b => b.as_json()) });
  });

  // Create booking is idempotent: a repeated key returns the original resource.
  app.post('/bookings', async (req, res) => {
    const key = req.get('Idempotency-Key');
    if (!key || key.trim().length < 8 || key.length > 200) return problem(res, 400, 'Invalid Idempotency-Key', 'Provide an Idempotency-Key header between 8 and 200 characters.');
    const validation = validateCreateBooking(req.body);
    if (!validation.valid) return problem(res, 400, 'Malformed booking request', validation.detail);

    const existing = store.byKey(key);
    if (existing) return res.status(201).location(`/bookings/${existing.id}`).json(existing.as_json());

    let equipment;
    try {
      equipment = await equipmentLookup(req.body.equipmentId);
    } catch (err) {
      if (err.status === 404) return problem(res, 422, 'Equipment unavailable', 'The requested equipment does not exist in the equipment catalogue.');
      if (err.status >= 400 && err.status < 500) return problem(res, 422, 'Equipment unavailable', 'The equipment catalogue rejected the requested equipment.');
      res.set('Retry-After', '2');
      return problem(res, 503, 'Equipment service unavailable', 'Could not verify equipment. Retry this request with the same Idempotency-Key.');
    }
    if (!equipment || equipment.available === false || equipment.isAvailable === false) return problem(res, 422, 'Equipment unavailable', 'The equipment is not available for booking.');

    // Owner approval and payment occur later in the agreed AgriRent lifecycle.
    const booking = store.create({
      equipmentId: req.body.equipmentId.trim(),
      renterId: req.body.renterId.trim(),
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      status: 'PENDING_OWNER_APPROVAL'
    }, key);
    return res.status(201).location(`/bookings/${booking.id}`).json(booking.as_json());
  });

  app.get('/bookings/:id', (req, res) => {
    const booking = store.get(req.params.id);
    if (!booking) return problem(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`);
    return res.status(200).json(booking.as_json());
  });

  // State-changing sub-resource. Only pending requests can be cancelled by renter.
  app.post('/bookings/:id/cancellation', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof req.body.reason !== 'string' || !req.body.reason.trim()) {
      return problem(res, 400, 'Malformed cancellation request', 'reason is required as a non-empty string.');
    }
    const result = store.cancel(req.params.id);
    if (result.kind === 'missing') return problem(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`);
    if (result.kind === 'conflict') return problem(res, 409, 'Booking state conflict', `A booking in ${result.booking.status} state cannot be cancelled by the renter through this operation.`);
    return res.status(200).json({ booking: result.booking.as_json(), cancellation: { reason: req.body.reason.trim() } });
  });

  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && 'body' in err) return problem(res, 400, 'Malformed JSON', 'Request body must contain valid JSON.');
    if (err.type === 'entity.too.large') return problem(res, 413, 'Request too large', 'Request body must be at most 100 KB.');
    return problem(res, 500, 'Internal server error', 'An unexpected error occurred.');
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 5001);
  createApp().listen(port, () => console.log(`AgriRent Booking Service listening on port ${port}`));
}
module.exports = { createApp };
