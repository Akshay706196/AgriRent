'use strict';

class Booking {
  constructor({ id, equipmentId, renterId, startDate, endDate, status = 'PENDING_OWNER_APPROVAL', idempotencyKey, createdAt = new Date().toISOString() }) {
    this.id = id;
    this.equipmentId = equipmentId;
    this.renterId = renterId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.status = status;
    this.idempotencyKey = idempotencyKey;
    this.createdAt = createdAt;
  }

  // Public representation intentionally excludes idempotencyKey/internal storage fields.
  as_json() {
    return {
      id: this.id,
      equipmentId: this.equipmentId,
      renterId: this.renterId,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

function validateCreateBooking(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, detail: 'Request body must be a JSON object.' };
  }
  for (const field of ['equipmentId', 'renterId', 'startDate', 'endDate']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) errors.push(`${field} is required and must be a non-empty string.`);
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof body.startDate === 'string' && !dateOnly.test(body.startDate)) errors.push('startDate must use YYYY-MM-DD format.');
  if (typeof body.endDate === 'string' && !dateOnly.test(body.endDate)) errors.push('endDate must use YYYY-MM-DD format.');
  if (dateOnly.test(body.startDate || '') && dateOnly.test(body.endDate || '') && body.endDate < body.startDate) errors.push('endDate must be on or after startDate.');
  if (errors.length) return { valid: false, detail: errors.join(' ') };
  return { valid: true };
}

module.exports = { Booking, validateCreateBooking };
