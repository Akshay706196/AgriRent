const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const claimsClient = require('../clients/claims.client');
const eventService = require('./event.service');
const AppError = require('../utils/AppError');
const { toPaise, toRupees, isValidAmount } = require('../utils/currency');

class SettlementService {
  /**
   * Settles completed rental booking and calculates financial distribution.
   *
   * SETTLEMENT FORMULA DOCUMENTATION:
   * 1. depositBalance = heldDeposit - lateFine - damageDeduction
   * 2. damageDeduction + lateFine must not exceed heldDeposit (otherwise 422 INVALID_DEDUCTION).
   * 3. Negative deduction amounts are strictly rejected with 422 INVALID_DEDUCTION.
   * 4. refundToRenter = depositBalance - disputedAmount (disputed amounts are held and not released).
   * 5. ownerPayout = rentalAmount + lateFine + damageDeduction
   *    (platform fee is retained by platform and is NOT paid out to the owner).
   * 6. Settlement is idempotent and strictly allowed only once per booking (409 SETTLEMENT_ALREADY_COMPLETED).
   */
  async settleBooking({
    bookingId,
    rentalAmount,
    lateFine = 0,
    damageDeduction = 0,
    disputedAmount = 0,
    user,
    correlationId = 'internal',
  }) {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }

    const db = getSqlDb();

    // 1. Enforce single settlement per booking constraint
    const existingSettlement = db.prepare('SELECT * FROM settlements WHERE bookingId = ?').get(bookingId);
    if (existingSettlement) {
      throw new AppError(
        409,
        'SETTLEMENT_ALREADY_COMPLETED',
        `A final settlement for booking '${bookingId}' has already been completed.`
      );
    }

    // 2. Fetch payment record (must be CONFIRMED)
    const payment = db.prepare('SELECT * FROM payments WHERE bookingId = ? AND status = ?').get(bookingId, 'CONFIRMED');
    if (!payment) {
      throw new AppError(
        422,
        'INVALID_BOOKING_STATE',
        `No CONFIRMED payment found for booking '${bookingId}'. Cannot settle unpaid booking.`
      );
    }

    // 3. Fetch deposit record (must be HELD)
    const deposit = db.prepare('SELECT * FROM deposits WHERE bookingId = ?').get(bookingId);
    if (!deposit || deposit.status !== 'HELD') {
      throw new AppError(
        422,
        'INVALID_BOOKING_STATE',
        `Security deposit for booking '${bookingId}' is not in HELD status.`
      );
    }

    // Call Claims Service to verify approved deductions before accepting settlement from an internal caller
    const isInternalCaller = user && (user.isService || user.role === 'ADMIN');
    if (isInternalCaller) {
      try {
        const approved = await claimsClient.getApprovedDeductions(bookingId, correlationId);
        if (approved) {
          if (approved.lateFine !== undefined && Math.round(lateFine * 100) !== Math.round(approved.lateFine * 100)) {
            throw new AppError(
              422,
              'INVALID_DEDUCTION',
              `Late fine mismatch: provided ${lateFine}, approved ${approved.lateFine}`
            );
          }
          if (
            approved.totalDamageDeduction !== undefined &&
            Math.round(damageDeduction * 100) !== Math.round(approved.totalDamageDeduction * 100)
          ) {
            throw new AppError(
              422,
              'INVALID_DEDUCTION',
              `Damage deduction mismatch: provided ${damageDeduction}, approved ${approved.totalDamageDeduction}`
            );
          }
        }
      } catch (err) {
        if (err.statusCode === 422 || err.statusCode === 503 || err.statusCode === 504) {
          throw err;
        }
      }
    }

    // 4. Validate monetary deduction inputs
    if (lateFine < 0 || damageDeduction < 0 || disputedAmount < 0) {
      throw new AppError(422, 'INVALID_DEDUCTION', 'Deduction and fine amounts cannot be negative.');
    }

    const heldDepositPaise = deposit.heldAmount;
    const lateFinePaise = toPaise(lateFine);
    const damageDeductionPaise = toPaise(damageDeduction);
    const disputedAmountPaise = toPaise(disputedAmount);

    const totalDeductions = lateFinePaise + damageDeductionPaise;

    // Check bounds: lateFine + damageDeduction must not exceed held deposit
    if (totalDeductions > heldDepositPaise) {
      throw new AppError(
        422,
        'INVALID_DEDUCTION',
        `Total deductions (lateFine: INR ${lateFine} + damageDeduction: INR ${damageDeduction} = INR ${toRupees(totalDeductions)}) exceed held deposit of INR ${toRupees(heldDepositPaise)}.`
      );
    }

    // Formula execution
    const depositBalancePaise = heldDepositPaise - totalDeductions;
    const refundToRenterPaise = Math.max(0, depositBalancePaise - disputedAmountPaise);

    // Snapshot rental amount: prefer payment.rentalAmount
    const rentalAmountPaise = rentalAmount !== undefined ? toPaise(rentalAmount) : payment.rentalAmount;
    const platformFeePaise = payment.platformFee;

    // Owner payout = rentalAmount + lateFine + damageDeduction
    const ownerPayoutPaise = rentalAmountPaise + lateFinePaise + damageDeductionPaise;

    const settlementId = `SET-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    const settlementStatus = disputedAmountPaise > 0 ? 'DISPUTED_HOLD' : 'COMPLETED';
    const newDepositStatus = totalDeductions > 0 ? 'PARTIALLY_DEDUCTED' : 'RELEASED';

    // SQL Transaction
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        INSERT INTO settlements (
          settlementId, bookingId, paymentId, depositId, rentalAmount, platformFee,
          heldDeposit, lateFine, damageDeduction, depositBalance, refundToRenter,
          ownerPayout, disputedAmount, status, settledAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        settlementId,
        bookingId,
        payment.paymentId,
        deposit.depositId,
        rentalAmountPaise,
        platformFeePaise,
        heldDepositPaise,
        lateFinePaise,
        damageDeductionPaise,
        depositBalancePaise,
        refundToRenterPaise,
        ownerPayoutPaise,
        disputedAmountPaise,
        settlementStatus,
        now,
        now
      );

      // Update deposit status
      db.prepare(`
        UPDATE deposits
        SET status = ?, releasedAt = ?, updatedAt = ?
        WHERE depositId = ?
      `).run(newDepositStatus, now, now, deposit.depositId);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Record audit event
    await eventService.recordEvent({
      paymentId: payment.paymentId,
      bookingId,
      eventType: 'SettlementCompleted',
      actor: user?.id || 'admin',
      entityId: settlementId,
      payload: {
        settlementId,
        refundToRenter: refundToRenterPaise,
        ownerPayout: ownerPayoutPaise,
        platformFee: platformFeePaise,
        lateFine: lateFinePaise,
        damageDeduction: damageDeductionPaise,
      },
      correlationId,
    });

    return {
      settlementId,
      bookingId,
      paymentId: payment.paymentId,
      rentalAmount: toRupees(rentalAmountPaise),
      platformFee: toRupees(platformFeePaise),
      heldDeposit: toRupees(heldDepositPaise),
      lateFine: toRupees(lateFinePaise),
      damageDeduction: toRupees(damageDeductionPaise),
      depositBalance: toRupees(depositBalancePaise),
      refundToRenter: toRupees(refundToRenterPaise),
      ownerPayout: toRupees(ownerPayoutPaise),
      disputedAmount: toRupees(disputedAmountPaise),
      status: settlementStatus,
      depositStatus: newDepositStatus,
      settledAt: now,
    };
  }

  /**
   * Retrieves settlement by settlementId or bookingId.
   */
  async getSettlement(bookingId, settlementId) {
    const db = getSqlDb();
    let settlement;
    if (settlementId) {
      settlement = db.prepare('SELECT * FROM settlements WHERE settlementId = ? AND bookingId = ?').get(settlementId, bookingId);
    } else {
      settlement = db.prepare('SELECT * FROM settlements WHERE bookingId = ?').get(bookingId);
    }

    if (!settlement) {
      throw new AppError(404, 'SETTLEMENT_NOT_FOUND', `Settlement record for booking '${bookingId}' was not found.`);
    }

    return {
      settlementId: settlement.settlementId,
      bookingId: settlement.bookingId,
      paymentId: settlement.paymentId,
      depositId: settlement.depositId,
      rentalAmount: toRupees(settlement.rentalAmount),
      platformFee: toRupees(settlement.platformFee),
      heldDeposit: toRupees(settlement.heldDeposit),
      lateFine: toRupees(settlement.lateFine),
      damageDeduction: toRupees(settlement.damageDeduction),
      depositBalance: toRupees(settlement.depositBalance),
      refundToRenter: toRupees(settlement.refundToRenter),
      ownerPayout: toRupees(settlement.ownerPayout),
      disputedAmount: toRupees(settlement.disputedAmount),
      status: settlement.status,
      settledAt: settlement.settledAt,
    };
  }

  /**
   * Contract endpoint for Claims service.
   */
  async getApprovedDeductions(bookingId, correlationId = 'internal') {
    return await claimsClient.getApprovedDeductions(bookingId, correlationId);
  }
}

module.exports = new SettlementService();
