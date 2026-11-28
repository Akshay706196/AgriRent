const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const caseService = require('./case.service');
const notificationClient = require('../clients/notification.client');
const ClaimEvidence = require('../models/ClaimEvidence');
const ClaimEvent = require('../models/ClaimEvent');
const clock = require('../utils/clock');
const { toPaise, toRupees } = require('../utils/currency');
const AppError = require('../utils/AppError');

class DecisionService {
  /**
   * Evaluates and decides a damage claim (Admin only).
   * Resolves any open dispute on the claim in the same SQL transaction.
   */
  async reviewDamageClaim({ claimId, decision, approvedAmount = 0, reason, adminUser, correlationId = 'internal' }) {
    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new AppError(403, 'ADMIN_REQUIRED', 'Only administrators may decide damage claims.');
    }

    const db = getSqlDb();

    // 1. Fetch claim
    const claim = db.prepare('SELECT * FROM claims WHERE claimId = ?').get(claimId);
    if (!claim) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', `Claim '${claimId}' was not found.`);
    }

    // 2. Check if already decided
    if (claim.status !== 'SUBMITTED') {
      throw new AppError(409, 'CLAIM_ALREADY_DECIDED', `Claim '${claimId}' has already been decided (${claim.status}).`);
    }

    const existingDecision = db.prepare('SELECT * FROM claim_decisions WHERE claimId = ?').get(claimId);
    if (existingDecision) {
      throw new AppError(409, 'CLAIM_ALREADY_DECIDED', `A decision has already been recorded for claim '${claimId}'.`);
    }

    const rentalCase = await caseService.getOrCreateRentalCase(claim.bookingId, correlationId);

    // 3. Evidence check: approving with no evidence -> 422 EVIDENCE_REQUIRED
    let approvedAmountPaise = 0;
    if (decision === 'APPROVED' || decision === 'PARTIALLY_APPROVED') {
      approvedAmountPaise = toPaise(approvedAmount);

      // Verify evidence exists in Mongo
      const evidenceDocs = await ClaimEvidence.find({ claimId });
      const totalPhotos = evidenceDocs.reduce((acc, doc) => acc + (doc.photos ? doc.photos.length : 0), 0);

      if (totalPhotos === 0) {
        throw new AppError(
          422,
          'EVIDENCE_REQUIRED',
          'Cannot approve damage claim: verifiable photo evidence is required.'
        );
      }

      // Check: approvedAmount > claimedAmount -> 422 INVALID_DEDUCTION
      if (approvedAmountPaise > claim.claimedAmount) {
        throw new AppError(
          422,
          'INVALID_DEDUCTION',
          `Approved amount (${toRupees(approvedAmountPaise)}) cannot exceed the claimed amount of ${toRupees(claim.claimedAmount)}.`
        );
      }

      // Check: sum of all approved deductions on the booking + lateFine > deposit held
      const prevDecisions = db
        .prepare(`
          SELECT cd.approvedAmount
          FROM claim_decisions cd
          JOIN claims c ON cd.claimId = c.claimId
          WHERE cd.bookingId = ? AND cd.decision IN ('APPROVED', 'PARTIALLY_APPROVED')
        `)
        .all(claim.bookingId);

      const existingDeductionsPaise = prevDecisions.reduce((sum, d) => sum + d.approvedAmount, 0);
      const totalProjectedDeductions = existingDeductionsPaise + approvedAmountPaise + rentalCase.lateFineAmountPaise;

      if (totalProjectedDeductions > rentalCase.depositHeldPaise) {
        throw new AppError(
          422,
          'INVALID_DEDUCTION',
          `Total approved deductions (${toRupees(existingDeductionsPaise + approvedAmountPaise)}) plus late fine (${rentalCase.lateFineAmount}) exceed the held deposit of ${rentalCase.depositHeld}.`
        );
      }
    } else {
      approvedAmountPaise = 0;
    }

    const decisionId = `DEC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const deductionId = approvedAmountPaise > 0 ? `DED-${crypto.randomBytes(4).toString('hex').toUpperCase()}` : null;
    const now = clock.toISOString();

    // 4. Atomic SQL transaction: Decision + Claim update + Dispute resolution
    db.exec('BEGIN TRANSACTION');
    try {
      // Insert decision
      db.prepare(`
        INSERT INTO claim_decisions (
          decisionId, claimId, bookingId, decision, approvedAmount, reason, decidedBy, decidedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        decisionId,
        claimId,
        claim.bookingId,
        decision,
        approvedAmountPaise,
        reason,
        adminUser.id,
        now
      );

      // Update claim status
      db.prepare(`
        UPDATE claims
        SET status = ?, updatedAt = ?
        WHERE claimId = ?
      `).run(decision, now, claimId);

      // Resolve any open dispute on this claim in the same SQL transaction
      db.prepare(`
        UPDATE disputes
        SET status = 'RESOLVED', decision = ?, decisionReason = ?, resolvedAt = ?, updatedAt = ?
        WHERE claimId = ? AND status = 'OPEN'
      `).run(decision, reason, now, now, claimId);

      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      throw err;
    }

    // 5. Update MongoDB ClaimEvidence to immutable
    try {
      await ClaimEvidence.updateMany({ claimId }, { $set: { isImmutable: true } });
    } catch {}

    // 6. Record timeline event in MongoDB
    try {
      const eventType =
        decision === 'APPROVED'
          ? 'DamageClaimApproved'
          : decision === 'PARTIALLY_APPROVED'
          ? 'DamageClaimPartiallyApproved'
          : 'DamageClaimRejected';

      await ClaimEvent.create({
        eventId: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        bookingId: claim.bookingId,
        claimId,
        eventType,
        actor: adminUser.id,
        actorRole: 'ADMIN',
        payload: {
          decisionId,
          decision,
          approvedAmount: toRupees(approvedAmountPaise),
          reason,
        },
        correlationId,
        timestamp: new Date(now),
      });
    } catch {}

    // 7. Notify both owner and renter
    await notificationClient.sendNotification({
      recipientId: rentalCase.ownerId,
      bookingId: claim.bookingId,
      claimId,
      type: 'ClaimDecided',
      message: `Damage claim ${claimId} was decided: ${decision} (Approved: INR ${toRupees(approvedAmountPaise)}).`,
      correlationId,
    });

    await notificationClient.sendNotification({
      recipientId: rentalCase.renterId,
      bookingId: claim.bookingId,
      claimId,
      type: 'ClaimDecided',
      message: `Damage claim ${claimId} was decided: ${decision} (Approved deduction: INR ${toRupees(approvedAmountPaise)}).`,
      correlationId,
    });

    return {
      decisionId,
      claimId,
      bookingId: claim.bookingId,
      decision,
      approvedAmount: toRupees(approvedAmountPaise),
      reason,
      decidedBy: adminUser.id,
      decidedAt: now,
      deduction: deductionId
        ? {
            deductionId,
            claimId,
            amount: toRupees(approvedAmountPaise),
          }
        : null,
    };
  }
}

module.exports = new DecisionService();
