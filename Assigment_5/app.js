'use strict';
const express = require('express');
const compression = require('compression');
const crypto = require('node:crypto');
const { BookingStore } = require('./store');
const { validateCreateBooking } = require('./models');
const { problem } = require('./errors');
const { getEquipment } = require('./dependency');

function etagFor(value) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
  return `"${hash}"`;
}

function createApp(options = {}) {
  const app = express();
  const store = options.store || new BookingStore();
  const equipmentLookup = options.equipmentLookup || getEquipment;
  const token = options.token || process.env.API_BEARER_TOKEN || 'agrirent-demo-token';
  const rateLimit = Number(options.rateLimit || process.env.RATE_LIMIT || 100);
  const rateWindowMs = Number(options.rateWindowMs || 60_000);
  const budgets = new Map();

  app.disable('x-powered-by');
  app.use(compression());

  // Global security, CORS and rate-limiting middleware
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Idempotency-Key, If-None-Match, If-Match, X-HTTP-Method-Override');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.set('Vary', 'Accept, Origin, Accept-Encoding');

    const client = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let budget = budgets.get(client);
    if (!budget || now >= budget.resetAt) budget = { count: 0, resetAt: now + rateWindowMs };
    budget.count += 1;
    budgets.set(client, budget);

    res.set('X-RateLimit-Limit', String(rateLimit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, rateLimit - budget.count)));

    if (budget.count > rateLimit && req.method !== 'OPTIONS') {
      res.set('Retry-After', String(Math.max(1, Math.ceil((budget.resetAt - now) / 1000))));
      return problem(res, 429, 'Rate limit exceeded', 'This client has exceeded its request budget. Retry after the indicated delay.');
    }

    // Handle CORS browser preflight request
    if (req.method === 'OPTIONS' && req.get('Access-Control-Request-Method')) {
      res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      return res.status(204).end();
    }
    next();
  });

  // A5: Support X-HTTP-Method-Override for constrained clients unable to send PUT/DELETE directly
  app.use((req, _res, next) => {
    const override = req.get('X-HTTP-Method-Override');
    if (req.method === 'POST' && override) {
      const targetMethod = override.toUpperCase();
      if (['PUT', 'DELETE', 'PATCH'].includes(targetMethod)) {
        req.method = targetMethod;
      }
    }
    next();
  });

  app.use(express.json({ limit: '100kb', strict: true }));

  // B1: Content-Type & Negotiation - Honour Accept header, return 406 if unsupported
  app.use((req, res, next) => {
    const accept = req.get('Accept');
    if (accept && !accept.includes('*/*') && !accept.includes('application/json') && !accept.includes('application/problem+json')) {
      return problem(res, 406, 'Not Acceptable', 'This API only returns JSON representations.');
    }
    next();
  });

  // B3: Authorization helper
  function auth(req, res) {
    const header = req.get('Authorization') || '';
    if (!header.startsWith('Bearer ') || !header.slice(7).trim() || header.slice(7).trim() !== token) {
      problem(res, 401, 'Unauthorized', 'Provide a valid Authorization: Bearer <token> header.');
      return false;
    }
    return true;
  }

  // Health check
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'agrirent-booking-service' }));

  // A4: Query parameters for filtering, sorting and pagination
  app.get('/bookings', (req, res) => {
    const statuses = ['PENDING_OWNER_APPROVAL', 'CANCELLED_BY_RENTER'];
    const { status, sort = 'createdAt', order = 'asc' } = req.query;
    if (status && !statuses.includes(status)) return problem(res, 400, 'Invalid query parameter', `status must be one of: ${statuses.join(', ')}.`);
    if (!['createdAt', 'startDate', 'endDate', 'id'].includes(sort) || !['asc', 'desc'].includes(order)) return problem(res, 400, 'Invalid sort parameters', 'sort must be createdAt, startDate, endDate or id; order must be asc or desc.');
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '20', 10)));
    const offset = Math.max(0, Number.parseInt(req.query.offset || '0', 10));
    if (!Number.isFinite(limit) || !Number.isFinite(offset)) return problem(res, 400, 'Invalid pagination', 'limit and offset must be integers.');
    const items = store.list(status).map(b => b.as_json()).sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (order === 'asc' ? 1 : -1));
    return res.status(200).json({ items: items.slice(offset, offset + limit), total: items.length, limit, offset });
  });

  // POST /bookings - Create booking with Idempotency-Key
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
      if (err.status === 404 || (err.status >= 400 && err.status < 500)) return problem(res, 422, 'Equipment unavailable', 'The requested equipment does not exist or is not available in the catalogue.');
      res.set('Retry-After', '2');
      return problem(res, 503, 'Equipment service unavailable', 'Could not verify equipment. Retry with the same Idempotency-Key.');
    }
    if (!equipment || equipment.available === false || equipment.isAvailable === false) return problem(res, 422, 'Equipment unavailable', 'The equipment is not available for booking.');
    const booking = store.create({ equipmentId: req.body.equipmentId.trim(), renterId: req.body.renterId.trim(), startDate: req.body.startDate, endDate: req.body.endDate, status: 'PENDING_OWNER_APPROVAL' }, key);
    return res.status(201).location(`/bookings/${booking.id}`).json(booking.as_json());
  });

  // A5 & B4 & C1 & C2: Endpoints on single booking resource
  app.route('/bookings/:id')
    .options((_req, res) => {
      res.set('Allow', 'GET, PUT, DELETE, OPTIONS');
      return res.status(204).end();
    })
    .get((req, res) => {
      const booking = store.get(req.params.id);
      if (!booking) return problem(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`);
      const representation = booking.as_json();
      const tag = etagFor(representation);
      res.set('ETag', tag).set('Cache-Control', 'private, max-age=0, must-revalidate');
      if (req.get('If-None-Match') === tag) return res.status(304).end();
      return res.status(200).json(representation);
    })
    .put((req, res) => {
      if (!auth(req, res)) return;
      const booking = store.get(req.params.id);
      if (!booking) return problem(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`);
      const currentTag = etagFor(booking.as_json());
      if (!req.get('If-Match')) return problem(res, 428, 'Precondition Required', 'Send the current ETag in If-Match before updating.');
      if (req.get('If-Match') !== currentTag) return problem(res, 412, 'Precondition Failed', 'The booking changed since it was read. Fetch it again before updating.');
      const validation = validateCreateBooking({ ...req.body, equipmentId: req.body && req.body.equipmentId || booking.equipmentId, renterId: booking.renterId });
      if (!validation.valid) return problem(res, 400, 'Malformed booking update', validation.detail);
      if (booking.status !== 'PENDING_OWNER_APPROVAL') return problem(res, 409, 'Booking state conflict', 'Only pending bookings can be updated.');
      booking.equipmentId = req.body.equipmentId || booking.equipmentId;
      booking.startDate = req.body.startDate;
      booking.endDate = req.body.endDate;
      return res.status(200).set('ETag', etagFor(booking.as_json())).json(booking.as_json());
    })
    .delete((req, res) => {
      if (!auth(req, res)) return;
      res.set('Allow', 'GET, PUT, OPTIONS');
      return problem(res, 405, 'Method Not Allowed', 'Direct deletion of bookings is not allowed. Use POST /bookings/{id}/cancellation to request cancellation.');
    });

  // A2: Sub-resource for cancellation
  app.post('/bookings/:id/cancellation', (req, res) => {
    if (!auth(req, res)) return;
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof req.body.reason !== 'string' || !req.body.reason.trim()) return problem(res, 400, 'Malformed cancellation request', 'reason is required as a non-empty string.');
    const result = store.cancel(req.params.id);
    if (result.kind === 'missing') return problem(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`);
    if (result.kind === 'conflict') return problem(res, 409, 'Booking state conflict', `A booking in ${result.booking.status} state cannot be cancelled by the renter through this operation.`);
    return res.status(200).json({ booking: result.booking.as_json(), cancellation: { reason: req.body.reason.trim() } });
  });

  // Catch-all options
  app.options('*', (_req, res) => {
    res.set('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.status(204).end();
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
  createApp().listen(port, () => console.log(`AgriRent Booking Service (Assignment 5) listening on port ${port}`));
}

module.exports = { createApp, etagFor };
