const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const AppError = require('../utils/AppError');
const clock = require('../utils/clock');
const pinService = require('./pin.service');
const { lateFineService } = require('./lateFine.service');
const outboxService = require('./outbox.service');
const eventService = require('./event.service');
const bookingClient = require('../clients/booking.client');
const logger = require('../utils/logger');

class ReturnService {
  /**
   * Verifies return PIN and completes machine return.
   * Atomically records return record, calculates and persists late fine in SAME transaction,
   * consumes PIN, and inserts outbox event.
   */
  async verifyReturn({
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
        'Only the equipment owner is authorized to verify the return PIN.'
      );
    }

    // 3. Verify booking status is IN_RENTAL
    if (booking.status !== 'IN_RENTAL') {
      throw new AppError(
        409,
        'BOOKING_NOT_IN_RENTAL',
        `Cannot execute return for booking in status '${booking.status}'. Booking must be in IN_RENTAL status.`
      );
    }

    // 4. Check if return already exists for this booking (enforce unique return constraint)
    const existingReturn = db.prepare('SELECT * FROM returns WHERE bookingId = ?').get(bookingId);
    if (existingReturn) {
      throw new AppError(
        409,
        'INVALID_BOOKING_STATE',
        `Equipment has already been returned for booking '${bookingId}'.`
      );
    }

    // 5. Validate PIN (attempts and locks are persisted immediately outside transaction)
    const validatedPin = await pinService.checkAndValidatePin({
      bookingId,
      type: 'RETURN',
      submittedPin: pin,
      actorId: user ? user.id : 'SYSTEM',
      correlationId,
    });

    const returnId = `RET-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const returnedAt = clock.toISOString();
    const fineId = `FINE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 6. Calculate late fine penalty using the authoritative business formula
    const lateFine = lateFineService.calculateFine({
      booking,
      actualReturnDate: returnedAt,
    });

    // 7. Execute atomic state transition in SQL transaction
    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      // Atomically consume PIN (ensures exactly one concurrent verification succeeds)
      const updateResult = db.prepare(`
        UPDATE pins
        SET status = 'USED', usedAt = ?, updatedAt = ?
        WHERE pinId = ? AND status = 'ACTIVE'
      `).run(returnedAt, returnedAt, validatedPin.pinId);

      if (updateResult.changes === 0) {
        throw new AppError(409, 'PIN_ALREADY_USED', 'This PIN has already been verified and used.');
      }

      // Insert return record
      db.prepare(`
        INSERT INTO returns (
          returnId, bookingId, pinId, returnedBy, returnedTo, returnedAt, status, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'RETURNED', ?, ?, ?)
      `).run(
        returnId,
        bookingId,
        validatedPin.pinId,
        booking.renterId,
        booking.ownerId,
        returnedAt,
        conditionReport?.visualInspectionNotes || null,
        returnedAt,
        returnedAt
      );

      // Persist late fine in late_fines table in the SAME SQL transaction
      db.prepare(`
        INSERT INTO late_fines (
          fineId, bookingId, returnId, dueDate, actualReturn, gracePeriodMinutes, overdueDuration,
          overdueMinutes, overdueDays, dailyRate, fineAmount, depositCapApplied, currency, status, calculatedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSESSED', ?, ?)
      `).run(
        fineId,
        bookingId,
        returnId,
        lateFine.dueDate,
        lateFine.actualReturn,
        lateFine.gracePeriodMinutes,
        lateFine.overdueDuration,
        lateFine.overdueMinutes,
        lateFine.overdueDays,
        lateFine.dailyRatePaise,
        lateFine.fineAmountPaise,
        lateFine.depositCapApplied ? 1 : 0,
        lateFine.currency,
        lateFine.calculatedAt,
        returnedAt
      );

      // Add outbox event for Booking service notification (IN_RENTAL -> RETURNED)
      outboxService.addEvent(db, {
        eventType: 'EquipmentReturned',
        aggregateId: bookingId,
        payload: {
          returnId,
          returnedAt,
          status: 'RETURNED',
          fineAmount: lateFine.fineAmountPaise,
        },
      });

      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      throw err;
    }

    // 7. Persist condition report and audit events in MongoDB
    await eventService.recordEvent({
      bookingId,
      eventType: 'EquipmentReturned',
      actor: user ? user.id : booking.ownerId,
      actorRole: 'OWNER',
      conditionReport,
      payload: {
        returnId,
        returnedAt,
        status: 'RETURNED',
        fineAmount: lateFine.fineAmount,
      },
      correlationId,
    });

    await eventService.recordEvent({
      bookingId,
      eventType: 'LateFineCalculated',
      actor: 'SYSTEM',
      actorRole: 'SYSTEM',
      payload: {
        fineId,
        returnId,
        overdueMinutes: lateFine.overdueMinutes,
        overdueDays: lateFine.overdueDays,
        fineAmount: lateFine.fineAmount,
        depositCapApplied: lateFine.depositCapApplied,
      },
      correlationId,
    });

    // TODO: Service 6 (Claims & Settlement) will consume the EquipmentReturned event and fineAmount
    // to execute final security deposit deductions and payout settlement via Payment.settlePayment.

    return {
      returnId,
      returnedAt,
      status: 'RETURNED',
      lateFine: {
        fineId,
        dueDate: lateFine.dueDate,
        actualReturn: lateFine.actualReturn,
        overdueDuration: lateFine.overdueDuration,
        overdueMinutes: lateFine.overdueMinutes,
        overdueDays: lateFine.overdueDays,
        dailyRate: lateFine.dailyRate,
        fineAmount: lateFine.fineAmount,
        depositCapApplied: lateFine.depositCapApplied,
        currency: lateFine.currency,
      },
    };
  }

  /**
   * Retrieves single return record by returnId.
   */
  async getReturn(bookingId, returnId) {
    const db = getSqlDb();
    const returnRecord = db.prepare(`
      SELECT * FROM returns WHERE bookingId = ? AND returnId = ?
    `).get(bookingId, returnId);

    if (!returnRecord) {
      throw new AppError(404, 'RETURN_NOT_FOUND', `Return record '${returnId}' was not found for booking '${bookingId}'.`);
    }

    const fine = db.prepare('SELECT * FROM late_fines WHERE returnId = ?').get(returnId);

    return {
      ...returnRecord,
      lateFine: fine ? {
        fineId: fine.fineId,
        dueDate: fine.dueDate,
        actualReturn: fine.actualReturn,
        overdueDuration: fine.overdueDuration,
        overdueMinutes: fine.overdueMinutes,
        overdueDays: fine.overdueDays,
        dailyRate: fine.dailyRate / 100,
        fineAmount: fine.fineAmount / 100,
        depositCapApplied: Boolean(fine.depositCapApplied),
        currency: fine.currency,
        calculatedAt: fine.calculatedAt,
      } : null,
    };
  }
}

module.exports = new ReturnService();
