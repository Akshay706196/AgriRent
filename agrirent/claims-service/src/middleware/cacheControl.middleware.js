/**
 * Deliberate HTTP Cache-Control header policies for AgriRent Claims, Disputes & Reviews Service.
 */

// Policy: Private, no-cache - For sensitive, mutable entities (claims, disputes) with ETag revalidation
const privateNoCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  next();
};

// Policy: Private, max-age=60 - For review lists that can tolerate a short cache
const privateShortCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'private, max-age=60');
  next();
};

// Policy: Private, max-age=0, must-revalidate - For state-dependent timelines and settlement status
const privateMustRevalidate = (req, res, next) => {
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  next();
};

// Policy: No-store - Strictly forbidden to store financial deductions and sensitive audit calculations
const noStore = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Policy: Public static documents (OpenAPI specification & GraphQL schema)
const publicStatic = (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  next();
};

module.exports = {
  privateNoCache,
  privateShortCache,
  privateMustRevalidate,
  noStore,
  publicStatic,
};
