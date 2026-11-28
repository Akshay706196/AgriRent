/**
 * Cache-Control middleware helpers with explicit financial and transactional caching policies.
 */

/**
 * Sets private, no-cache policy for sensitive financial entities (payment, settlement) paired with ETag revalidation.
 * Rationale: Financial transaction ledgers are private to participants and must revalidate with the server before reuse.
 */
function privateNoCache(req, res, next) {
  res.setHeader('Cache-Control', 'private, no-cache');
  next();
}

/**
 * Sets private, must-revalidate policy for fast-changing polling statuses (payment status, handover readiness).
 * Rationale: Status polling endpoints change rapidly and should never serve stale cached states to downstream services.
 */
function privateMustRevalidate(req, res, next) {
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  next();
}

/**
 * Sets no-store policy for highly sensitive audit records and webhook events.
 * Rationale: Audit logs and security event trails must never be written to any client or intermediate proxy cache.
 */
function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
}

module.exports = {
  privateNoCache,
  privateMustRevalidate,
  noStore,
};
