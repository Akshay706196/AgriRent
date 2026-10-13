'use strict';
const express = require('express');
const compression = require('compression');
const crypto = require('node:crypto');
const { BookingStore } = require('./store');
const { validateCreateBooking } = require('./models');
const { problem } = require('./errors');
const { getEquipment } = require('./dependency');

function etagFor(value) {
  return `"${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24)}"`;
}

function xmlEscape(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toXml(value, root = 'response') {
  if (Array.isArray(value)) return `<${root}>${value.map(v => toXml(v, 'item')).join('')}</${root}>`;
  if (value && typeof value === 'object') return `<${root}>${Object.entries(value).map(([k, v]) => toXml(v, k)).join('')}</${root}>`;
  return `<${root}>${xmlEscape(value)}</${root}>`;
}

function createApp(options = {}) {
  const app = express();
  const store = options.store || new BookingStore();
  const equipmentLookup = options.equipmentLookup || getEquipment;
  const token = options.token || process.env.API_BEARER_TOKEN || 'agrirent-demo-token';
  const rateLimit = Number(options.rateLimit || process.env.RATE_LIMIT || 100);
  const rateWindowMs = Number(options.rateWindowMs || 60000);
  const budgets = new Map();

  app.disable('x-powered-by');
  app.use(compression());

  // Global security, CORS and per-client rate-limiting middleware
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
    budget.count++;
    budgets.set(client, budget);

    res.set('X-RateLimit-Limit', String(rateLimit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, rateLimit - budget.count)));

    if (budget.count > rateLimit && req.method !== 'OPTIONS') {
      res.set('Retry-After', String(Math.max(1, Math.ceil((budget.resetAt - now) / 1000))));
      return problem(res, 429, 'Rate limit exceeded', 'This client has exceeded its request budget. Retry after Retry-After seconds.', 'rate-limit');
    }

    // CORS preflight handling
    if (req.method === 'OPTIONS' && req.get('Access-Control-Request-Method')) {
      res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      return res.status(204).end();
    }
    next();
  });

  // Support X-HTTP-Method-Override for constrained clients
  app.use((req, _res, next) => {
    const override = req.get('X-HTTP-Method-Override');
    if (req.method === 'POST' && override) {
      const target = override.toUpperCase();
      if (['PUT', 'DELETE', 'PATCH'].includes(target)) req.method = target;
    }
    next();
  });

  app.use(express.json({ limit: '100kb', strict: true }));

  // Content-Type & negotiation middleware: Honour Accept header (JSON & XML), 406 if unsupported
  app.use((req, res, next) => {
    const a = req.get('Accept');
    if (a && !a.includes('*/*') && !a.includes('application/json') && !a.includes('application/xml') && !a.includes('application/problem+json')) {
      return problem(res, 406, 'Not Acceptable', 'Supported representations are application/json and application/xml.', 'not-acceptable');
    }
    next();
  });

  // Ensure all response bodies are UTF-8 labelled without duplicating charset
  app.use((req, res, next) => {
    const originalType = res.type.bind(res);
    res.type = (type) => {
      originalType(type);
      const current = res.get('Content-Type') || type;
      if (!current.includes('charset')) {
        res.set('Content-Type', `${current}; charset=utf-8`);
      }
      return res;
    };
    next();
  });

  function send(res, status, value, headers = {}) {
    Object.entries(headers).forEach(([k, v]) => res.set(k, v));
    if (status === 204 || status === 304) return res.status(status).end();
    const accept = (res.req.get('Accept') || 'application/json');
    if (accept.includes('application/xml')) {
      return res.status(status).type('application/xml').send(toXml(value));
    }
    return res.status(status).type('application/json').json(value);
  }

  function fail(res, status, title, detail, type, errors) {
    return problem(res, status, title, detail, type, errors);
  }

  function auth(req, res) {
    const h = req.get('Authorization') || '';
    if (!h.startsWith('Bearer ') || !h.slice(7).trim() || h.slice(7).trim() !== token) {
      fail(res, 401, 'Unauthorized', 'Provide a valid Authorization: Bearer <token> header.', 'unauthorized');
      return false;
    }
    return true;
  }

  app.get('/health', (_req, res) => send(res, 200, { status: 'ok', service: 'agrirent-booking-service' }));

  app.get('/bookings', (req, res) => {
    const statuses = ['PENDING_OWNER_APPROVAL', 'CANCELLED_BY_RENTER'];
    const { status, sort = 'createdAt', order = 'asc' } = req.query;
    if (status && !statuses.includes(status)) return fail(res, 400, 'Invalid query parameter', `status must be one of: ${statuses.join(', ')}.`, 'bad-request');
    if (!['createdAt', 'startDate', 'endDate', 'id'].includes(sort) || !['asc', 'desc'].includes(order)) return fail(res, 400, 'Invalid sort parameters', 'sort must be createdAt, startDate, endDate or id; order must be asc or desc.', 'bad-request');
    const rawLimit = Number(req.query.limit || 20);
    const rawOffset = Number(req.query.offset || 0);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100 || !Number.isInteger(rawOffset) || rawOffset < 0) return fail(res, 400, 'Invalid pagination', 'limit must be 1..100 and offset must be a non-negative integer.', 'bad-request');
    const items = store.list(status).map(b => b.as_json()).sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (order === 'asc' ? 1 : -1));
    return send(res, 200, { items: items.slice(rawOffset, rawOffset + rawLimit), total: items.length, limit: rawLimit, offset: rawOffset });
  });

  app.post('/bookings', async (req, res) => {
    const key = req.get('Idempotency-Key');
    if (!key || key.trim().length < 8 || key.length > 200) return fail(res, 400, 'Invalid Idempotency-Key', 'Provide an Idempotency-Key header between 8 and 200 characters.', 'bad-request');
    const validation = validateCreateBooking(req.body);
    if (!validation.valid) return fail(res, 422, 'Request validation failed', 'One or more booking fields are invalid.', 'validation-error', validation.errors);
    const existing = store.byKey(key);
    if (existing) return send(res, 201, existing.as_json(), { Location: `/bookings/${existing.id}` });
    let equipment;
    try {
      equipment = await equipmentLookup(req.body.equipmentId);
    } catch (err) {
      if (err.status >= 400 && err.status < 500) return fail(res, 422, 'Equipment unavailable', 'The requested equipment does not exist or is unavailable.', 'item-unavailable');
      res.set('Retry-After', '2');
      return fail(res, 503, 'Equipment service unavailable', 'Could not verify equipment. Retry with the same Idempotency-Key.', 'service-unavailable');
    }
    if (!equipment || equipment.available === false || equipment.isAvailable === false) return fail(res, 422, 'Equipment unavailable', 'The equipment is not available for booking.', 'item-unavailable');
    const booking = store.create({ equipmentId: req.body.equipmentId.trim(), renterId: req.body.renterId.trim(), startDate: req.body.startDate, endDate: req.body.endDate, status: 'PENDING_OWNER_APPROVAL' }, key);
    return send(res, 201, booking.as_json(), { Location: `/bookings/${booking.id}` });
  });

  app.route('/bookings/:id')
    .options((_req, res) => res.set('Allow', 'GET, PUT, DELETE, OPTIONS').status(204).end())
    .get((req, res) => {
      const b = store.get(req.params.id);
      if (!b) return fail(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`, 'booking-not-found');
      const rep = b.as_json();
      const tag = etagFor(rep);
      res.set('ETag', tag).set('Cache-Control', 'private, max-age=0, must-revalidate');
      if (req.get('If-None-Match') === tag) return res.status(304).end();
      return send(res, 200, rep);
    })
    .put((req, res) => {
      if (!auth(req, res)) return;
      const b = store.get(req.params.id);
      if (!b) return fail(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`, 'booking-not-found');
      const tag = etagFor(b.as_json());
      if (!req.get('If-Match')) return fail(res, 428, 'Precondition Required', 'Send the current ETag in If-Match before updating.', 'precondition-required');
      if (req.get('If-Match') !== tag) return fail(res, 412, 'Precondition Failed', 'The booking changed since it was read. Fetch it again before updating.', 'precondition-failed');
      const validation = validateCreateBooking({ ...req.body, equipmentId: req.body && req.body.equipmentId || b.equipmentId, renterId: b.renterId });
      if (!validation.valid) return fail(res, 422, 'Request validation failed', 'One or more booking fields are invalid.', 'validation-error', validation.errors);
      if (b.status !== 'PENDING_OWNER_APPROVAL') return fail(res, 409, 'Illegal booking transition', 'Only pending bookings can be updated.', 'illegal-transition');
      b.equipmentId = req.body.equipmentId || b.equipmentId;
      b.startDate = req.body.startDate;
      b.endDate = req.body.endDate;
      return send(res, 200, b.as_json(), { ETag: etagFor(b.as_json()) });
    })
    .delete((req, res) => {
      if (!auth(req, res)) return;
      res.set('Allow', 'GET, PUT, OPTIONS');
      return fail(res, 405, 'Method Not Allowed', 'Use POST /bookings/{id}/cancellation to request cancellation.', 'bad-request');
    });

  app.post('/bookings/:id/cancellation', (req, res) => {
    if (!auth(req, res)) return;
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof req.body.reason !== 'string' || !req.body.reason.trim()) {
      return fail(res, 400, 'Malformed cancellation request', 'reason is required as a non-empty string.', 'bad-request');
    }
    const result = store.cancel(req.params.id);
    if (result.kind === 'missing') return fail(res, 404, 'Booking not found', `No booking exists with id ${req.params.id}.`, 'booking-not-found');
    if (result.kind === 'conflict') return fail(res, 409, 'Illegal booking transition', `A booking in ${result.booking.status} state cannot be cancelled by this operation.`, 'illegal-transition');
    return send(res, 200, { booking: result.booking.as_json(), cancellation: { reason: req.body.reason.trim() } });
  });

  app.options('*', (_req, res) => {
    res.set('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.status(204).end();
  });

  app.use((err, _req, res, _next) => {
    console.error('Request failed:', err && err.message ? err.message : 'unknown internal error');
    if (err instanceof SyntaxError && 'body' in err) return fail(res, 400, 'Malformed JSON', 'Request body must contain valid JSON.', 'bad-request');
    if (err.type === 'entity.too.large') return fail(res, 413, 'Request too large', 'Request body must be at most 100 KB.', 'bad-request');
    return fail(res, 500, 'Internal server error', 'An unexpected error occurred.', 'internal-error');
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 5001);
  createApp().listen(port, () => console.log(`AgriRent Booking Service (Assignment 6) listening on port ${port}`));
}

module.exports = { createApp, etagFor };
