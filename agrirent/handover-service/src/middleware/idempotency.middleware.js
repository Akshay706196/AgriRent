const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// Set to track in-flight idempotency keys to detect concurrent duplicates
const inFlightKeys = new Set();

/**
 * Deterministic SHA-256 hash of a payload object.
 */
function hashPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return crypto.createHash('sha256').update(String(payload || '')).digest('hex');
  }

  // Sort keys deeply for stable deterministic hashing
  const sortObject = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObject);
    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObject(obj[key]);
        return result;
      }, {});
  };

  const normalized = JSON.stringify(sortObject(payload));
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Sanitizes response body to guarantee that no PIN is persisted in idempotency snapshots.
 */
function sanitizeResponseBody(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...body };
  delete clone.pin;
  delete clone.dev_pin;
  delete clone.hashedPin;
  return clone;
}

/**
 * Idempotency middleware persisted in SQL with SHA-256 request hash and response snapshots.
 * @param {Object} options
 * @param {boolean} options.required If true, rejects requests lacking an Idempotency-Key header with 400
 */
function requireIdempotency(options = { required: true }) {
  return (req, res, next) => {
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!rawKey) {
      if (options.required) {
        return next(
          new AppError(
            400,
            'MISSING_IDEMPOTENCY_KEY',
            'Idempotency-Key header is required for this operation.'
          )
        );
      }
      return next();
    }

    const key = String(rawKey).trim();
    req.idempotencyKey = key;

    // 1. Detect concurrent in-flight requests with the exact same key -> 409 DUPLICATE_REQUEST
    if (inFlightKeys.has(key)) {
      return next(
        new AppError(
          409,
          'DUPLICATE_REQUEST',
          'A request with this Idempotency-Key is currently in flight. Please await completion.'
        )
      );
    }

    inFlightKeys.add(key);

    // Clean up in-flight set when request finishes or closes
    const releaseLock = () => {
      inFlightKeys.delete(key);
    };
    res.on('finish', releaseLock);
    res.on('close', releaseLock);

    try {
      const db = getSqlDb();
      const currentHash = hashPayload(req.body);

      // 2. Query SQL idempotency_keys table
      const stmt = db.prepare('SELECT * FROM idempotency_keys WHERE key = ?');
      const existing = stmt.get(key);

      if (existing) {
        // Check expiry
        const now = new Date();
        const expiry = new Date(existing.expiresAt);

        if (now <= expiry) {
          // Check if request hash matches
          if (existing.requestHash !== currentHash) {
            // Same key + different body = 422 IDEMPOTENCY_CONFLICT
            return next(
              new AppError(
                422,
                'IDEMPOTENCY_CONFLICT',
                'This Idempotency-Key was previously used with a different request payload.'
              )
            );
          }

          // Same key + same body = Replay stored response with header
          // Security contract: Replayed response MUST NOT contain a PIN
          res.setHeader('Idempotent-Replayed', 'true');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          const parsedBody = JSON.parse(existing.responseBody);
          return res.status(existing.responseCode).json(parsedBody);
        }
      }

      // 3. Intercept response to persist upon successful 2xx execution
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const createdAt = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour TTL

            // Strictly sanitize stored response body so no PIN is persisted
            const sanitized = sanitizeResponseBody(body);

            const insertStmt = db.prepare(`
              INSERT OR REPLACE INTO idempotency_keys (
                key, requestPath, requestMethod, requestHash, responseCode, responseBody, createdAt, expiresAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            insertStmt.run(
              key,
              req.originalUrl || req.url,
              req.method,
              currentHash,
              res.statusCode,
              JSON.stringify(sanitized),
              createdAt,
              expiresAt
            );
          } catch (dbErr) {
            logger.error(`[Idempotency] Failed to persist SQL idempotency record for key ${key}: ${dbErr.message}`);
          }
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      inFlightKeys.delete(key);
      next(err);
    }
  };
}

module.exports = {
  requireIdempotency,
  hashPayload,
};
