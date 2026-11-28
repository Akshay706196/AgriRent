const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const gatewayClient = require('../gateways');
const eventService = require('./event.service');
const AppError = require('../utils/AppError');
const { toPaise, toRupees, isValidAmount } = require('../utils/currency');

class RefundService {
  /**
   * Processes a refund against a CONFIRMED payment.
   */
  async processRefund({
    paymentId,
    amount,
    reason = 'Customer cancellation',
    idempotencyKey = null,
    user,
    correlationId = 'internal',
  }) {
    if (!paymentId) {
      throw new AppError(400, 'INVALID_INPUT', 'paymentId is required.');
    }

    if (!isValidAmount(amount) || Number(amount) <= 0) {
      throw new AppError(422, 'REFUND_NOT_ALLOWED', 'Refund amount must be a positive number.');
    }

    const db = getSqlDb();
    const payment = db.prepare('SELECT * FROM payments WHERE paymentId = ?').get(paymentId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment record '${paymentId}' was not found.`);
    }

    // State machine: Only CONFIRMED or PARTIALLY_REFUNDED payments can be refunded
    if (payment.status !== 'CONFIRMED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new AppError(
        422,
        'REFUND_NOT_ALLOWED',
        `Cannot refund payment in '${payment.status}' status. Only CONFIRMED payments can be refunded.`
      );
    }

    const amountPaise = toPaise(amount);
    const currentRefunded = payment.refundedAmount || 0;
    const maxRefundable = payment.totalAmount - currentRefunded;

    // Check bounds: total refunded cannot exceed total paid
    if (amountPaise > maxRefundable) {
      throw new AppError(
        422,
        'REFUND_NOT_ALLOWED',
        `Refund amount of INR ${amount} exceeds refundable remainder of INR ${toRupees(maxRefundable)}.`
      );
    }

    // Check duplicate refund idempotency key in refunds table
    if (idempotencyKey) {
      const existingRefund = db.prepare('SELECT * FROM refunds WHERE idempotencyKey = ?').get(idempotencyKey);
      if (existingRefund) {
        throw new AppError(409, 'DUPLICATE_REFUND', 'A refund with this Idempotency-Key has already been processed.');
      }
    }

    // Call gateway to process refund
    const gatewayRes = await gatewayClient.processRefund({
      paymentId: payment.gatewayPaymentId || payment.paymentId,
      amount: amountPaise,
      notes: { reason, bookingId: payment.bookingId },
    });

    const refundId = `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    const newRefundedTotal = currentRefunded + amountPaise;
    const newStatus = newRefundedTotal === payment.totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    // SQL Transaction for atomic refund update
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        INSERT INTO refunds (
          refundId, paymentId, bookingId, amount, reason, status, gatewayRefundId, idempotencyKey, createdAt
        ) VALUES (?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)
      `).run(
        refundId,
        payment.paymentId,
        payment.bookingId,
        amountPaise,
        reason,
        gatewayRes.refundId || gatewayRes.id,
        idempotencyKey,
        now
      );

      db.prepare(`
        UPDATE payments
        SET refundedAmount = ?, status = ?, updatedAt = ?
        WHERE paymentId = ?
      `).run(newRefundedTotal, newStatus, now, payment.paymentId);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Record event
    await eventService.recordEvent({
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      eventType: 'RefundCompleted',
      actor: user?.id || 'admin',
      entityId: refundId,
      payload: {
        refundId,
        amount: amountPaise,
        newStatus,
      },
      correlationId,
    });

    return {
      refundId,
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      amount: toRupees(amountPaise),
      totalRefunded: toRupees(newRefundedTotal),
      paymentStatus: newStatus,
      status: 'SUCCESS',
      reason,
      createdAt: now,
    };
  }
}

module.exports = new RefundService();
