const crypto = require('crypto');

/**
 * Generates an ETag for a given data object.
 * @param {Object|string} data
 * @returns {string} ETag header value
 */
function generateETag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('sha1').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Checks If-None-Match against calculated ETag and sends 304 if matched.
 * @param {Request} req
 * @param {Response} res
 * @param {Object} data
 * @returns {boolean} true if 304 was sent, false otherwise
 */
function handleETag(req, res, data) {
  const etag = generateETag(data);
  res.setHeader('ETag', etag);

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === '*' || ifNoneMatch === `W/${etag}`)) {
    res.status(304).end();
    return true;
  }
  return false;
}

module.exports = {
  generateETag,
  handleETag,
};
