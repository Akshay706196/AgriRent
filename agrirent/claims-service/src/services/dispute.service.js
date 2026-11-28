const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const caseService = require('./case.service');
const notificationClient = require('../clients/notification.client');
const ClaimEvent = require('../models/ClaimEvent');
const clock = require('../utils/clock');
const AppError = require('../utils/AppError');

class DisputeService {
  /**
   * Raises a dispute against a submitted claim (Renter action).
   */
  async raiseDispute({ claimId, user, reason, evidence, correlationId = 'internal' }) {
    const db = getSqlDb();

    // 1. Fetch claim
    const claim = db.prepare('SELECT * FROM claims WHERE claimId = ?').get(claimId);
    if (!claim) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', `Claim '${claimId}' was not found.`);
    }

    // 2. Fetch rental case
    const rentalCase = await caseService.getOrCreateRentalCase(claim.bookingId, correlationId);

    // 3. Authorization: Only the renter can dispute the claim
    if (user.role !== 'ADMIN') {
      if (user.id !== rentalCase.renterId && user.id !== rentalCase.ownerId) {
        throw new AppError(403, 'NOT_PARTICIPANT', 'Only booking participants may access disputes.');
      }
      if (user.id !== rentalCase.renterId) {
        throw new AppError(403, 'NOT_PARTICIPANT', 'Only the renter can raise a dispute against an owner damage claim.');
      }
    }

    // 4. Claim state validation: Must be SUBMITTED
    if (claim.status !== 'SUBMITTED') {
      throw new AppError(
        409,
        'INVALID_CLAIM_STATE',
        `Cannot dispute a claim that has already been decided. Status is '${claim.status}'.`
      );
    }

    // 5. Dispute window check: DISPUTE_WINDOW_HOURS after claim creation
    const disputeWindowHours = parseInt(process.env.DISPUTE_WINDOW_HOURS, 10) || 72;
    const claimCreatedAt = new Date(claim.createdAt).getTime();
    const disputeDeadline = new Date(claimCreatedAt + disputeWindowHours * 60 * 60 * 1000);

    if (clock.now() > disputeDeadline) {
      throw new AppError(
        409,
        'DISPUTE_WINDOW_CLOSED',
        `Dispute window for claim '${claimId}' closed at ${disputeDeadline.toISOString()}.`
      );
    }

    // 6. Check if an OPEN dispute already exists for this claim
    const existingOpenDispute = db
      .prepare('SELECT * FROM disputes WHERE claimId = ? AND status = ?')
      .get(claimId, 'OPEN');
    if (existingOpenDispute) {
      throw new AppError(
        409,
        'DISPUTE_ALREADY_OPEN',
        `An open dispute '${existingOpenDispute.disputeId}' already exists for this claim.`
      );
    }

    const disputeId = `DSP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const eventId = `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const now = clock.toISOString();

    // 7. Insert dispute record in SQL
    db.prepare(`
      INSERT INTO disputes (
        disputeId, claimId, bookingId, raisedBy, reason, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)
    `).run(
      disputeId,
      claimId,
      claim.bookingId,
      user.id,
      reason,
      now,
      now
    );

    // 8. Record event in MongoDB
    try {
      await ClaimEvent.create({
        eventId,
        bookingId: claim.bookingId,
        claimId,
        eventType: 'DisputeRaised',
        actor: user.id,
        actorRole: 'RENTER',
        payload: {
          disputeId,
          reason,
        },
        correlationId,
        timestamp: new Date(now),
      });
    } catch {}

    // 9. Notify owner & admin
    await notificationClient.sendNotification({
      recipientId: rentalCase.ownerId,
      bookingId: claim.bookingId,
      claimId,
      type: 'DisputeRaised',
      message: `Renter has raised a dispute against damage claim ${claimId}.`,
      correlationId,
    });

    return {
      disputeId,
      claimId,
      bookingId: claim.bookingId,
      status: 'OPEN',
      reason,
      createdAt: now,
    };
  }

  /**
   * Retrieves dispute status by disputeId.
   */
  async getDispute(disputeId, user, correlationId = 'internal') {
    const db = getSqlDb();
    const dispute = db.prepare('SELECT * FROM disputes WHERE disputeId = ?').get(disputeId);

    if (!dispute) {
      throw new AppError(404, 'DISPUTE_NOT_FOUND', `Dispute '${disputeId}' was not found.`);
    }

    if (user && user.role !== 'ADMIN' && !user.isService) {
      const rentalCase = await caseService.getOrCreateRentalCase(dispute.bookingId, correlationId);
      if (user.id !== rentalCase.renterId && user.id !== rentalCase.ownerId) {
        throw new AppError(403, 'ACCESS_DENIED', 'You are not authorized to view this dispute.');
      }
    }

    return {
      disputeId: dispute.disputeId,
      claimId: dispute.claimId,
      bookingId: dispute.bookingId,
      raisedBy: dispute.raisedBy,
      reason: dispute.reason,
      status: dispute.status,
      decision: dispute.decision || null,
      decisionReason: dispute.decisionReason || null,
      resolvedAt: dispute.resolvedAt || null,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
    };
  }

  /**
   * Lists disputes with cursor pagination.
   */
  async listDisputes({ claimId, status, limit = 10, cursor = null, user }) {
    const db = getSqlDb();
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const conditions = [];
    const params = [];

    if (claimId) {
      conditions.push('claimId = ?');
      params.push(claimId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorDate, cursorId] = decoded.split('_');
        conditions.push('(createdAt < ? OR (createdAt = ? AND disputeId < ?))');
        params.push(cursorDate, cursorDate, cursorId);
      } catch {}
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM disputes
      ${whereClause}
      ORDER BY createdAt DESC, disputeId DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(...params, pageSize + 1);
    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      const raw = `${last.createdAt}_${last.disputeId}`;
      nextCursor = Buffer.from(raw).toString('base64');
    }

    return {
      items: items.map((d) => ({
        disputeId: d.disputeId,
        claimId: d.claimId,
        bookingId: d.bookingId,
        raisedBy: d.raisedBy,
        reason: d.reason,
        status: d.status,
        decision: d.decision || null,
        decisionReason: d.decisionReason || null,
        resolvedAt: d.resolvedAt || null,
        createdAt: d.createdAt,
      })),
      hasMore,
      nextCursor,
    };
  }
}

module.exports = new DisputeService();
