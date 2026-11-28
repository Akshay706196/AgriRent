const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const AppError = require('../utils/AppError');
const clock = require('../utils/clock');
const pinService = require('./pin.service');
const outboxService = require('./outbox.service');
const eventService = require('./event.service');
const bookingClient = require('../clients/booking.client');
const paymentClient = require('../clients/payment.client');
const logger = require('../utils/logger');

class HandoverService {
  /**
   * Verifies handover PIN and completes machine handover.
   * Atomically records handover record, consumes PIN, and inserts outbox event.
   */
  async verifyHandover({
    bookingId,
    pin,
    conditionReport = null,
    user,
    correlationId = 'internal',
  }) {
    if (!bookingId || !pin) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId and pin are required.');
    }

    const db = getSqlDb();

    // 1. Fetch authoritative booking details
    const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // 2. Caller Authorization: Caller must be the equipment OWNER
    const isOwner = user && (user.id === booking.ownerId);
    const isAdminOrService = user && (user.role === 'ADMIN' || user.isService);

    if (!isOwner && !isAdminOrService) {
      throw new AppError(
        403,
        'UNAUTHORIZED_USER',
        'Only the equipment owner is authorized to verify the handover PIN.'
      );
    }

    // 3. Verify booking status is PAID
    if (booking.status !== 'PAID') {
      throw new AppError(
        409,
        'INVALID_BOOKING_STATE',
        `Cannot execute handover for booking in status '${booking.status}'. Booking must be in PAID status.`
      );
    }

    // 4. Verify payment status with Payment Service
    const paymentStatus = await paymentClient.getPaymentStatus(bookingId, correlationId);
    if (!paymentStatus || paymentStatus.paymentStatus !== 'CONFIRMED') {
      throw new AppError(
        409,
        'PAYMENT_NOT_CONFIRMED',
        'Handover requires verified payment. Current payment status is not CONFIRMED.'
      );
    }

    // 5. Check if handover already exists for this booking (enforce unique handover constraint)
    const existingHandover = db.prepare('SELECT * FROM handovers WHERE bookingId = ?').get(bookingId);
    if (existingHandover) {
      throw new AppError(
        409,
        'INVALID_BOOKING_STATE',
        `Equipment has already been handed over for booking '${bookingId}'.`
      );
    }

    // 6. Validate PIN (attempts and locks are persisted immediately outside transaction)
    const validatedPin = await pinService.checkAndValidatePin({
      bookingId,
      type: 'HANDOVER',
      submittedPin: pin,
      actorId: user ? user.id : 'SYSTEM',
      correlationId,
    });

    const handoverId = `HO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const handedOverAt = clock.toISOString();

    // 7. Execute atomic state transition in SQL transaction
    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      // Atomically consume PIN (ensures exactly one concurrent verification succeeds)
      const updateResult = db.prepare(`
        UPDATE pins
        SET status = 'USED', usedAt = ?, updatedAt = ?
        WHERE pinId = ? AND status = 'ACTIVE'
      `).run(handedOverAt, handedOverAt, validatedPin.pinId);

      if (updateResult.changes === 0) {
        throw new AppError(409, 'PIN_ALREADY_USED', 'This PIN has already been verified and used.');
      }

      // Insert handover record
      db.prepare(`
        INSERT INTO handovers (
          handoverId, bookingId, pinId, handedOverBy, handedOverTo, handedOverAt, status, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'IN_RENTAL', ?, ?, ?)
      `).run(
        handoverId,
        bookingId,
        validatedPin.pinId,
        booking.ownerId,
        booking.renterId,
        handedOverAt,
        conditionReport?.visualInspectionNotes || null,
        handedOverAt,
        handedOverAt
      );

      // Add outbox event for Booking service notification (PAID -> IN_RENTAL)
      outboxService.addEvent(db, {
        eventType: 'EquipmentHandedOver',
        aggregateId: bookingId,
        payload: {
          handoverId,
          handedOverAt,
          status: 'IN_RENTAL',
        },
      });

      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      throw err;
    }

    // 7. Persist condition report and audit event in MongoDB
    await eventService.recordEvent({
      bookingId,
      eventType: 'EquipmentHandedOver',
      actor: user ? user.id : booking.ownerId,
      actorRole: 'OWNER',
      conditionReport,
      payload: {
        handoverId,
        handedOverAt,
        status: 'IN_RENTAL',
      },
      correlationId,
    });

    return {
      handoverId,
      handedOverAt,
      status: 'IN_RENTAL',
    };
  }

  /**
   * Retrieves single handover record by handoverId.
   */
  async getHandover(bookingId, handoverId) {
    const db = getSqlDb();
    const handover = db.prepare(`
      SELECT * FROM handovers WHERE bookingId = ? AND handoverId = ?
    `).get(bookingId, handoverId);

    if (!handover) {
      throw new AppError(404, 'HANDOVER_NOT_FOUND', `Handover '${handoverId}' was not found for booking '${bookingId}'.`);
    }

    return handover;
  }

  /**
   * Retrieves cursor-paginated list of handovers.
   */
  async listHandovers({ bookingId, status, limit = 10, cursor = null }) {
    const db = getSqlDb();
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const conditions = [];
    const params = [];

    if (bookingId) {
      conditions.push('bookingId = ?');
      params.push(bookingId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorTime, cursorId] = decoded.split('_');
        conditions.push('(handedOverAt < ? OR (handedOverAt = ? AND handoverId < ?))');
        params.push(cursorTime, cursorTime, cursorId);
      } catch {
        // Invalid cursor ignored
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM handovers
      ${whereClause}
      ORDER BY handedOverAt DESC, handoverId DESC
      LIMIT ?
    `;

    params.push(pageSize + 1);
    const rows = db.prepare(query).all(...params);

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const rawCursor = `${lastItem.handedOverAt}_${lastItem.handoverId}`;
      nextCursor = Buffer.from(rawCursor).toString('base64');
    }

    return {
      items,
      hasMore,
      nextCursor,
    };
  }
}

module.exports = new HandoverService();
