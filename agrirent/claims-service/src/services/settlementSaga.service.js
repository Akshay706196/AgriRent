const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const caseService = require('./case.service');
const paymentClient = require('../clients/payment.client');
const outboxService = require('./outbox.service');
const ClaimEvent = require('../models/ClaimEvent');
const clock = require('../utils/clock');
const { toPaise, toRupees } = require('../utils/currency');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

let sagaWorkerInterval = null;

class SettlementSagaService {
  /**
   * Waives damage claim window early (Owner action).
   */
  async waiveClaimWindow({ bookingId, user, correlationId = 'internal' }) {
    const rentalCase = await caseService.getOrCreateRentalCase(bookingId, correlationId);

    if (user.role !== 'ADMIN' && user.id !== rentalCase.ownerId) {
      throw new AppError(403, 'NOT_EQUIPMENT_OWNER', 'Only the equipment owner can waive the damage claim window.');
    }

    if (rentalCase.waivedAt) {
      return {
        bookingId,
        message: 'Damage claim window is already waived.',
        waivedAt: rentalCase.waivedAt,
        alreadyWaived: true,
      };
    }

    const now = clock.toISOString();
    const db = getSqlDb();

    db.prepare(`
      UPDATE rental_cases
      SET waivedAt = ?, updatedAt = ?
      WHERE bookingId = ?
    `).run(now, now, bookingId);

    try {
      await ClaimEvent.create({
        eventId: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        bookingId,
        eventType: 'ClaimWaived',
        actor: user.id,
        actorRole: user.role === 'ADMIN' ? 'ADMIN' : 'OWNER',
        payload: { waivedAt: now },
        correlationId,
        timestamp: new Date(now),
      });
    } catch {}

    logger.info(`[SettlementSaga] Claim window waived for booking ${bookingId} by ${user.id}`);

    return {
      bookingId,
      status: 'WAIVED',
      waivedAt: now,
    };
  }

  /**
   * Evaluates settlement eligibility based on local SQL state and snapshots.
   */
  evaluateEligibility(bookingId) {
    const db = getSqlDb();
    const rentalCase = db.prepare('SELECT * FROM rental_cases WHERE bookingId = ?').get(bookingId);

    if (!rentalCase) {
      return { eligible: false, reasons: ['Rental case not found'] };
    }

    const reasons = [];
    const now = clock.now();

    // 1. Claim window must be closed (by deadline or waiver)
    const windowClosesAt = new Date(rentalCase.claimWindowClosesAt);
    const windowClosed = Boolean(rentalCase.waivedAt) || now > windowClosesAt;
    if (!windowClosed) {
      reasons.push(`Claim window remains open until ${rentalCase.claimWindowClosesAt}.`);
    }

    // 2. No claims in SUBMITTED status
    const submittedClaims = db
      .prepare('SELECT COUNT(*) as count FROM claims WHERE bookingId = ? AND status = ?')
      .get(bookingId, 'SUBMITTED');
    const hasOpenClaims = submittedClaims.count > 0;
    if (hasOpenClaims) {
      reasons.push(`${submittedClaims.count} damage claim(s) are pending admin decision.`);
    }

    // 3. No disputes in OPEN status (BLOCK_SETTLEMENT policy)
    const openDisputes = db
      .prepare('SELECT COUNT(*) as count FROM disputes WHERE bookingId = ? AND status = ?')
      .get(bookingId, 'OPEN');
    const hasOpenDisputes = openDisputes.count > 0;
    if (hasOpenDisputes) {
      reasons.push(`${openDisputes.count} dispute(s) are currently open.`);
    }

    // 4. Not already completed
    const existingSettlement = db
      .prepare('SELECT * FROM settlement_requests WHERE bookingId = ? AND status = ?')
      .get(bookingId, 'COMPLETED');
    if (existingSettlement) {
      reasons.push('Settlement has already been completed.');
    }

    return {
      eligible: reasons.length === 0,
      windowClosed,
      hasOpenClaims,
      hasOpenDisputes,
      reasons,
    };
  }

  /**
   * Internal contract endpoint for Payment Service (GetApprovedDeductions).
   * Reads only Claims local data without calling Payment to avoid call loops.
   */
  async getApprovedDeductions(bookingId) {
    const db = getSqlDb();
    const rentalCase = db.prepare('SELECT * FROM rental_cases WHERE bookingId = ?').get(bookingId);

    if (!rentalCase) {
      throw new AppError(404, 'CASE_NOT_FOUND', `Rental case for booking '${bookingId}' was not found.`);
    }

    // Fetch approved claim decisions
    const approvedClaims = db
      .prepare(`
        SELECT cd.decisionId, cd.claimId, cd.approvedAmount, c.status
        FROM claim_decisions cd
        JOIN claims c ON cd.claimId = c.claimId
        WHERE cd.bookingId = ? AND cd.decision IN ('APPROVED', 'PARTIALLY_APPROVED')
      `)
      .all(bookingId);

    let totalDamageDeductionPaise = 0;
    const deductions = approvedClaims.map((item) => {
      totalDamageDeductionPaise += item.approvedAmount;
      return {
        deductionId: `DED-${item.decisionId}`,
        claimId: item.claimId,
        amount: toRupees(item.approvedAmount),
        amountPaise: item.approvedAmount,
        consumed: item.status === 'SETTLED',
      };
    });

    const eligibility = this.evaluateEligibility(bookingId);

    return {
      bookingId,
      lateFine: toRupees(rentalCase.lateFineAmount),
      lateFinePaise: rentalCase.lateFineAmount,
      approvedDeductions: deductions,
      totalDamageDeduction: toRupees(totalDamageDeductionPaise),
      totalDamageDeductionPaise,
      hasOpenClaims: eligibility.hasOpenClaims,
      hasOpenDisputes: eligibility.hasOpenDisputes,
      windowClosed: eligibility.windowClosed,
      eligible: eligibility.eligible,
    };
  }

  /**
   * Requests settlement manually or triggers immediate evaluation.
   */
  async requestSettlement({ bookingId, user, correlationId = 'internal' }) {
    await caseService.getOrCreateRentalCase(bookingId, correlationId);
    const eligibility = this.evaluateEligibility(bookingId);

    if (!eligibility.eligible) {
      throw new AppError(
        409,
        'SETTLEMENT_NOT_ELIGIBLE',
        'Booking is not currently eligible for security deposit settlement.',
        eligibility.reasons
      );
    }

    const db = getSqlDb();
    const existing = db.prepare('SELECT * FROM settlement_requests WHERE bookingId = ?').get(bookingId);
    if (existing) {
      if (existing.status === 'COMPLETED') {
        throw new AppError(409, 'SETTLEMENT_ALREADY_COMPLETED', 'Settlement for this booking is already completed.');
      }
      return {
        settlementRequestId: existing.requestId,
        bookingId,
        status: existing.status,
        alreadyRequested: true,
      };
    }

    const approvedDeductions = await this.getApprovedDeductions(bookingId);
    const rentalCase = db.prepare('SELECT * FROM rental_cases WHERE bookingId = ?').get(bookingId);

    const rentalAmountPaise = rentalCase.rentalAmount;
    const lateFinePaise = rentalCase.lateFineAmount;
    const damageDeductionPaise = approvedDeductions.totalDamageDeductionPaise;
    const depositBalancePaise = Math.max(0, rentalCase.depositHeld - lateFinePaise - damageDeductionPaise);

    const requestId = `SETREQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = clock.toISOString();

    db.prepare(`
      INSERT INTO settlement_requests (
        requestId, bookingId, status, rentalAmount, lateFine, damageDeduction, depositBalance,
        attempts, createdAt, updatedAt
      ) VALUES (?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?)
    `).run(
      requestId,
      bookingId,
      rentalAmountPaise,
      lateFinePaise,
      damageDeductionPaise,
      depositBalancePaise,
      now,
      now
    );

    try {
      await ClaimEvent.create({
        eventId: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        bookingId,
        eventType: 'SettlementRequested',
        actor: user?.id || 'admin',
        actorRole: user?.role === 'ADMIN' ? 'ADMIN' : 'SYSTEM',
        payload: {
          requestId,
          lateFine: toRupees(lateFinePaise),
          damageDeduction: toRupees(damageDeductionPaise),
        },
        correlationId,
        timestamp: new Date(now),
      });
    } catch {}

    return {
      settlementRequestId: requestId,
      bookingId,
      status: 'PENDING',
      rentalAmount: toRupees(rentalAmountPaise),
      lateFine: toRupees(lateFinePaise),
      damageDeduction: toRupees(damageDeductionPaise),
      depositBalance: toRupees(depositBalancePaise),
      createdAt: now,
    };
  }

  /**
   * Retrieves overall settlement status for participants and admin.
   */
  async getSettlementStatus(bookingId, user, correlationId = 'internal') {
    const rentalCase = await caseService.getOrCreateRentalCase(bookingId, correlationId);

    if (user && user.role !== 'ADMIN' && !user.isService) {
      if (user.id !== rentalCase.ownerId && user.id !== rentalCase.renterId) {
        throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view the settlement status of this booking.');
      }
    }

    const db = getSqlDb();
    const settlementRequest = db.prepare('SELECT * FROM settlement_requests WHERE bookingId = ?').get(bookingId);

    const claims = db.prepare('SELECT claimId, claimedAmount, status FROM claims WHERE bookingId = ?').all(bookingId);
    const disputes = db.prepare('SELECT disputeId, status FROM disputes WHERE bookingId = ?').all(bookingId);

    const eligibility = this.evaluateEligibility(bookingId);
    const approvedDeductions = await this.getApprovedDeductions(bookingId);

    return {
      bookingId,
      caseStatus: rentalCase.status,
      windowClosed: rentalCase.windowClosed,
      claimWindowClosesAt: rentalCase.claimWindowClosesAt,
      waivedAt: rentalCase.waivedAt,
      depositHeld: rentalCase.depositHeld,
      lateFine: rentalCase.lateFineAmount,
      totalDamageDeduction: approvedDeductions.totalDamageDeduction,
      claimsCount: claims.length,
      openClaimsCount: claims.filter((c) => c.status === 'SUBMITTED').length,
      openDisputesCount: disputes.filter((d) => d.status === 'OPEN').length,
      eligibleForSettlement: eligibility.eligible,
      settlementRequest: settlementRequest
        ? {
            requestId: settlementRequest.requestId,
            status: settlementRequest.status,
            settlementId: settlementRequest.settlementId,
            attempts: settlementRequest.attempts,
            failureReason: settlementRequest.failureReason,
            createdAt: settlementRequest.createdAt,
            updatedAt: settlementRequest.updatedAt,
          }
        : null,
      evaluatedAt: clock.toISOString(),
    };
  }

  /**
   * Background Saga Worker execution cycle:
   * Finds eligible cases, creates pending settlement requests, and executes Payment settlement calls.
   */
  async processEligibleSettlements() {
    const db = getSqlDb();
    const maxAttempts = parseInt(process.env.SETTLEMENT_MAX_ATTEMPTS, 10) || 3;

    try {
      // 1. Scan for eligible rental cases without any settlement request
      const activeCases = db.prepare("SELECT bookingId FROM rental_cases WHERE status != 'SETTLED'").all();
      for (const c of activeCases) {
        const hasReq = db.prepare('SELECT 1 FROM settlement_requests WHERE bookingId = ?').get(c.bookingId);
        if (!hasReq) {
          const elig = this.evaluateEligibility(c.bookingId);
          if (elig.eligible) {
            try {
              await this.requestSettlement({ bookingId: c.bookingId, user: { id: 'SYSTEM', role: 'ADMIN' } });
              logger.info(`[SettlementSaga] Created pending settlement request for eligible booking ${c.bookingId}`);
            } catch (err) {
              logger.warn(`[SettlementSaga] Could not auto-request settlement for ${c.bookingId}: ${err.message}`);
            }
          }
        }
      }

      // 2. Fetch pending or retryable settlement requests
      const pendingRequests = db
        .prepare(`
          SELECT * FROM settlement_requests
          WHERE status = 'PENDING' AND attempts < ?
          ORDER BY createdAt ASC
          LIMIT 5
        `)
        .all(maxAttempts);

      for (const req of pendingRequests) {
        await this._executeSettlementSagaStep(req);
      }
    } catch (err) {
      logger.error(`[SettlementSaga] Background worker polling error: ${err.message}`);
    }
  }

  /**
   * Executes a single settlement request step against Payment Service.
   */
  async _executeSettlementSagaStep(settlementRequest) {
    const db = getSqlDb();
    const { bookingId, requestId } = settlementRequest;
    const deterministicIdempKey = `claims-settle-${bookingId}`;
    const now = clock.toISOString();

    const payload = {
      rentalAmount: toRupees(settlementRequest.rentalAmount),
      lateFine: toRupees(settlementRequest.lateFine),
      damageDeduction: toRupees(settlementRequest.damageDeduction),
      depositBalance: toRupees(settlementRequest.depositBalance),
      disputedAmount: 0,
    };

    try {
      logger.info(`[SettlementSaga] Calling Payment settlements for ${bookingId} (attempt ${settlementRequest.attempts + 1})`);
      const paymentRes = await paymentClient.settleBooking(
        bookingId,
        payload,
        deterministicIdempKey,
        `saga-${requestId}`
      );

      const settlementId = paymentRes.data?.settlementId || `SET-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // SUCCESS / ALREADY COMPLETED -> Mark COMPLETED, mark claims SETTLED
      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`
          UPDATE settlement_requests
          SET status = 'COMPLETED', settlementId = ?, attempts = attempts + 1, lastAttemptAt = ?, updatedAt = ?
          WHERE requestId = ?
        `).run(settlementId, now, now, requestId);

        // Mark rental case SETTLED
        db.prepare(`
          UPDATE rental_cases
          SET status = 'SETTLED', updatedAt = ?
          WHERE bookingId = ?
        `).run(now, bookingId);

        // Mark approved claims SETTLED (consumed)
        db.prepare(`
          UPDATE claims
          SET status = 'SETTLED', updatedAt = ?
          WHERE bookingId = ? AND status IN ('APPROVED', 'PARTIALLY_APPROVED')
        `).run(now, bookingId);

        // Queue outbox event to notify Booking Service: RETURNED -> COMPLETED
        outboxService.addEvent(db, {
          eventType: 'SettlementCompleted',
          aggregateId: bookingId,
          payload: {
            settlementId,
            status: 'COMPLETED',
          },
        });

        db.exec('COMMIT');
      } catch (txErr) {
        try { db.exec('ROLLBACK'); } catch {}
        throw txErr;
      }

      // Record audit event in MongoDB
      try {
        await ClaimEvent.create({
          eventId: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          bookingId,
          eventType: 'SettlementCompleted',
          actor: 'SETTLEMENT_SAGA_WORKER',
          actorRole: 'SYSTEM',
          payload: {
            requestId,
            settlementId,
            refund: paymentRes.data?.refundToRenter,
            payout: paymentRes.data?.ownerPayout,
          },
          correlationId: `saga-${requestId}`,
          timestamp: new Date(now),
        });
      } catch {}

      logger.info(`[SettlementSaga] Settlement COMPLETED successfully for booking ${bookingId} (settlementId: ${settlementId})`);
    } catch (err) {
      const nextAttempt = settlementRequest.attempts + 1;
      const maxAttempts = parseInt(process.env.SETTLEMENT_MAX_ATTEMPTS, 10) || 3;

      if (err.statusCode === 422) {
        // Business error: compensation -> Stop retrying, flag for admin review
        db.prepare(`
          UPDATE settlement_requests
          SET status = 'FAILED_NEEDS_REVIEW', failureReason = ?, attempts = attempts + 1, lastAttemptAt = ?, updatedAt = ?
          WHERE requestId = ?
        `).run(`422 INVALID_DEDUCTION: ${err.message}`, now, now, requestId);

        try {
          await ClaimEvent.create({
            eventId: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
            bookingId,
            eventType: 'SettlementFailed',
            actor: 'SETTLEMENT_SAGA_WORKER',
            actorRole: 'SYSTEM',
            payload: { requestId, reason: err.message, status: 'FAILED_NEEDS_REVIEW' },
            correlationId: `saga-${requestId}`,
            timestamp: new Date(now),
          });
        } catch {}

        logger.error(`[SettlementSaga] Settlement FAILED_NEEDS_REVIEW for ${bookingId}: ${err.message}`);
      } else {
        // Transient error (5xx, timeout, circuit breaker)
        const isExhausted = nextAttempt >= maxAttempts;
        const newStatus = isExhausted ? 'FAILED_NEEDS_REVIEW' : 'PENDING';

        db.prepare(`
          UPDATE settlement_requests
          SET status = ?, failureReason = ?, attempts = attempts + 1, lastAttemptAt = ?, updatedAt = ?
          WHERE requestId = ?
        `).run(newStatus, `Transient error: ${err.message}`, now, now, requestId);

        logger.warn(`[SettlementSaga] Settlement attempt ${nextAttempt}/${maxAttempts} failed for ${bookingId}: ${err.message}`);
      }
    }
  }

  startWorker(intervalMs = 4000) {
    if (!sagaWorkerInterval) {
      sagaWorkerInterval = setInterval(() => this.processEligibleSettlements(), intervalMs);
      logger.info(`[SettlementSaga] Background settlement saga worker started (polling every ${intervalMs}ms)`);
    }
  }

  stopWorker() {
    if (sagaWorkerInterval) {
      clearInterval(sagaWorkerInterval);
      sagaWorkerInterval = null;
      logger.info('[SettlementSaga] Background settlement saga worker stopped.');
    }
  }
}

module.exports = new SettlementSagaService();
