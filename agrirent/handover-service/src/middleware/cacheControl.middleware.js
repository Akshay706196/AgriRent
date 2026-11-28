/**
 * Cache-Control middleware helpers with deliberate caching policies.
 */

/**
 * Sets private, no-cache policy for immutable machine handover and return records paired with ETag revalidation.
 * Rationale: Handover and return ledger records are private to booking participants and must revalidate with server before reuse.
 */
function privateNoCache(req, res, next) {
  res.setHeader('Cache-Control', 'private, no-cache');
  next();
}

/**
 * Sets no-store policy for dynamically previewed late fine calculations and ephemeral security records.
 * Rationale: Late-fine preview calculations depend on dynamic request parameters and clock time; never store in intermediate or client caches.
 */
function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
}

/**
 * Sets private, must-revalidate policy for polling and list queries.
 * Rationale: Event timelines and handover listings change as operations progress and must revalidate.
 */
function privateMustRevalidate(req, res, next) {
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  next();
}

module.exports = {
  privateNoCache,
  noStore,
  privateMustRevalidate,
};
