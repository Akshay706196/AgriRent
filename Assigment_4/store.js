'use strict';
const { Booking } = require('./models');

class BookingStore {
  constructor() {
    this.bookings = new Map();
    this.idempotency = new Map();
    this.nextId = 1;
  }
  create(data, key) {
    const id = String(this.nextId++);
    const booking = new Booking({ id, ...data, idempotencyKey: key });
    this.bookings.set(id, booking);
    if (key) this.idempotency.set(key, id);
    return booking;
  }
  get(id) { return this.bookings.get(String(id)) || null; }
  byKey(key) { const id = this.idempotency.get(key); return id ? this.get(id) : null; }
  list(status) { return [...this.bookings.values()].filter(b => !status || b.status === status); }
  cancel(id) {
    const booking = this.get(id);
    if (!booking) return { kind: 'missing' };
    if (booking.status !== 'PENDING_OWNER_APPROVAL') return { kind: 'conflict', booking };
    booking.status = 'CANCELLED_BY_RENTER';
    return { kind: 'ok', booking };
  }
}
module.exports = { BookingStore };
