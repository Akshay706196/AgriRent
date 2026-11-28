const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const eventService = require('./event.service');
const AppError = require('../utils/AppError');
const { toPaise, toRupees, isValidAmount } = require('../utils/currency');

class DepositService {
  /**
   * Holds security deposit for a booking after payment is confirmed.
   */
  async holdDeposit({
    bookingId,
    depositAmount,
    paymentReference,
    user,
    correlationId = 'internal',
  }) {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }

    const db = getSqlDb();

    // Verify payment is CONFIRMED
    const payment = db.prepare('SELECT * FROM payments WHERE bookingId = ? AND status = ?').get(bookingId, 'CONFIRMED');
    if (!payment) {
      throw new AppError(
        422,
        'DEPOSIT_FAILED',
        'Cannot hold deposit: no CONFIRMED payment exists for this booking.'
      );
    }

    const amount = depositAmount !== undefined ? depositAmount : toRupees(payment.securityDeposit);
    if (!isValidAmount(amount) || Number(amount) <= 0) {
      throw new AppError(422, 'DEPOSIT_FAILED', 'depositAmount must be a valid positive number.');
    }

    const amountPaise = toPaise(amount);

    // Check if deposit already HELD
    const existing = db.prepare('SELECT * FROM deposits WHERE bookingId = ?').get(bookingId);
    if (existing && existing.status === 'HELD') {
      throw new AppError(
        409,
        'DEPOSIT_ALREADY_HELD',
        `A security deposit of INR ${toRupees(existing.heldAmount)} is already HELD for booking '${bookingId}'.`
      );
    }

    const depositId = existing ? existing.depositId : `DEP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(`
        UPDATE deposits
        SET heldAmount = ?, depositAmount = ?, status = 'HELD', paymentReference = ?, heldAt = ?, updatedAt = ?
        WHERE depositId = ?
      `).run(amountPaise, amountPaise, paymentReference || payment.transactionReference, now, now, depositId);
    } else {
      db.prepare(`
        INSERT INTO deposits (
          depositId, bookingId, paymentId, renterId, depositAmount, heldAmount, status, paymentReference, heldAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'HELD', ?, ?, ?, ?)
      `).run(
        depositId,
        bookingId,
        payment.paymentId,
        payment.renterId,
        amountPaise,
        amountPaise,
        paymentReference || payment.transactionReference,
        now,
        now,
        now
      );
    }

    await eventService.recordEvent({
      paymentId: payment.paymentId,
      bookingId,
      eventType: 'DepositHeld',
      actor: user?.id || 'system',
      entityId: depositId,
      payload: { heldAmount: amountPaise },
      correlationId,
    });

    return {
      depositId,
      bookingId,
      heldAmount: toRupees(amountPaise),
      status: 'HELD',
      heldAt: now,
    };
  }

  async getDeposit(bookingId) {
    const db = getSqlDb();
    const deposit = db.prepare('SELECT * FROM deposits WHERE bookingId = ?').get(bookingId);
    if (!deposit) {
      throw new AppError(404, 'DEPOSIT_NOT_FOUND', `No deposit record found for booking '${bookingId}'.`);
    }
    return {
      depositId: deposit.depositId,
      bookingId: deposit.bookingId,
      paymentId: deposit.paymentId,
      renterId: deposit.renterId,
      depositAmount: toRupees(deposit.depositAmount),
      heldAmount: toRupees(deposit.heldAmount),
      status: deposit.status,
      paymentReference: deposit.paymentReference,
      heldAt: deposit.heldAt,
      releasedAt: deposit.releasedAt,
    };
  }
}

module.exports = new DepositService();
