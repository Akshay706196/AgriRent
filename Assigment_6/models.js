'use strict';
class Booking {
  constructor({ id, equipmentId, renterId, startDate, endDate, status = 'PENDING_OWNER_APPROVAL', idempotencyKey, createdAt = new Date().toISOString() }) {
    Object.assign(this, { id, equipmentId, renterId, startDate, endDate, status, idempotencyKey, createdAt });
  }
  as_json() { return { id: this.id, equipmentId: this.equipmentId, renterId: this.renterId, startDate: this.startDate, endDate: this.endDate, status: this.status, createdAt: this.createdAt }; }
}
function validateCreateBooking(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { valid: false, errors: [{ field: 'body', reason: 'must be a JSON object' }] };
  for (const field of ['equipmentId', 'renterId', 'startDate', 'endDate']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) errors.push({ field, reason: 'is required and must be a non-empty string' });
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof body.startDate === 'string' && !dateOnly.test(body.startDate)) errors.push({ field: 'startDate', reason: 'must use YYYY-MM-DD format' });
  if (typeof body.endDate === 'string' && !dateOnly.test(body.endDate)) errors.push({ field: 'endDate', reason: 'must use YYYY-MM-DD format' });
  if (dateOnly.test(body.startDate || '') && dateOnly.test(body.endDate || '') && body.endDate < body.startDate) errors.push({ field: 'endDate', reason: 'must be on or after startDate' });
  return { valid: errors.length === 0, errors };
}
module.exports = { Booking, validateCreateBooking };
