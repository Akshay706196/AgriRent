const { Builder } = require('xml2js');
const AppError = require('../utils/AppError');

/**
 * Middleware enforcing content negotiation on selected endpoints.
 * Supports: application/json, application/xml, and wildcards (*).
 * Rejects unsupported media types with 406 NOT_ACCEPTABLE.
 */
function requireContentNegotiation(req, res, next) {
  const accept = req.headers['accept'] || '*/*';

  if (
    accept.includes('*/*') ||
    accept.includes('application/json') ||
    accept.includes('+json')
  ) {
    req.responseFormat = 'json';
    return next();
  }

  if (
    accept.includes('application/xml') ||
    accept.includes('text/xml') ||
    accept.includes('+xml')
  ) {
    req.responseFormat = 'xml';
    return next();
  }

  // Not acceptable -> 406
  return next(
    new AppError(
      406,
      'NOT_ACCEPTABLE',
      'The requested representation is not supported. Accept header must be application/json or application/xml.'
    )
  );
}

/**
 * Helper to send response in negotiated format (JSON or XML).
 */
function sendNegotiatedResponse(req, res, statusCode, data, rootName = 'response') {
  if (req.responseFormat === 'xml') {
    const builder = new Builder({
      rootName,
      headless: false,
      renderOpts: { pretty: true, indent: '  ', newline: '\n' },
    });
    const xml = builder.buildObject(data);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(statusCode).send(xml);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(data);
}

module.exports = {
  requireContentNegotiation,
  sendNegotiatedResponse,
};
