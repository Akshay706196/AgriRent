'use strict';
const TYPES = {
  'empty-cart': 'https://agrirent.example/problems/empty-cart',
  'item-unavailable': 'https://agrirent.example/problems/item-unavailable',
  'payment-declined': 'https://agrirent.example/problems/payment-declined',
  'booking-not-found': 'https://agrirent.example/problems/booking-not-found',
  'illegal-transition': 'https://agrirent.example/problems/illegal-transition',
  'validation-error': 'https://agrirent.example/problems/validation-error',
  'unauthorized': 'https://agrirent.example/problems/unauthorized',
  'rate-limit': 'https://agrirent.example/problems/rate-limit',
  'not-acceptable': 'https://agrirent.example/problems/not-acceptable',
  'internal-error': 'https://agrirent.example/problems/internal-error',
  'precondition-failed': 'https://agrirent.example/problems/precondition-failed',
  'precondition-required': 'https://agrirent.example/problems/precondition-required',
  'bad-request': 'https://agrirent.example/problems/bad-request',
  'service-unavailable': 'https://agrirent.example/problems/service-unavailable'
};
function problem(res, status, title, detail, type = 'bad-request', errors) {
  const body = { type: TYPES[type] || TYPES['bad-request'], title, status, detail };
  if (Array.isArray(errors) && errors.length) body.errors = errors;
  return res.status(status).type('application/problem+json').json(body);
}
module.exports = { problem, TYPES };
