const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const caseService = require('./case.service');
const bookingClient = require('../clients/booking.client');
const handoverClient = require('../clients/handover.client');
const notificationClient = require('../clients/notification.client');
const ClaimEvidence = require('../models/ClaimEvidence');
const ClaimEvent = require('../models/ClaimEvent');
const clock = require('../utils/clock');
const { toPaise, toRupees } = require('../utils/currency');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class ClaimService {
  /**
   * Submits a damage claim against the booking deposit.
   */
  async submitDamageClaim({
    bookingId,
    claimantId,
    reason,
    claimedAmount,
    evidence,
    bodyClaimantId,
    user,
    correlationId = 'internal',
  }) {
    // 1. Claimant ID check: if claimantId is in body and disagrees with JWT -> 400 INVALID_CLAIM
    if (bodyClaimantId && bodyClaimantId !== claimantId) {
      throw new AppError(400, 'INVALID_CLAIM', 'claimantId in request body does not match authenticated user identity.');
    }

    if (!claimedAmount || claimedAmount <= 0) {
      throw new AppError(400, 'INVALID_CLAIM', 'claimedAmount must be a positive number.');
    }

    if (!evidence || !Array.isArray(evidence.photos) || evidence.photos.length === 0) {
      throw new AppError(400, 'INVALID_CLAIM', 'Damage claim must include at least one photo reference in evidence.');
    }

    // 2. Fetch or create local case snapshot
    const rentalCase = await caseService.getOrCreateRentalCase(bookingId, correlationId);

    // 3. Authorization check
    if (user.role !== 'ADMIN' && claimantId !== rentalCase.ownerId && claimantId !== rentalCase.renterId) {
      throw new AppError(403, 'NOT_PARTICIPANT', 'Only booking participants or administrators may access claims.');
    }

    if (user.role !== 'ADMIN' && claimantId === rentalCase.renterId) {
      throw new AppError(403, 'NOT_EQUIPMENT_OWNER', 'Renters cannot file damage claims against their own rental deposit.');
    }

    // 4. Booking status validation: booking must be RETURNED
    const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
    if (!booking || (booking.status !== 'RETURNED' && booking.status !== 'COMPLETED')) {
      throw new AppError(
        409,
        'INVALID_BOOKING_STATE',
        `Damage claims can only be filed after equipment is RETURNED. Current status: '${booking?.status || 'UNKNOWN'}'.`
      );
    }

    // 5. Window validation: CLAIM_WINDOW_HOURS after returnedAt, or waived
    const now = clock.now();
    const windowClosesAtDate = new Date(rentalCase.claimWindowClosesAt);

    if (rentalCase.waivedAt || now > windowClosesAtDate) {
      throw new AppError(
        409,
        'CLAIM_WINDOW_CLOSED',
        `The damage claim window for booking '${bookingId}' has expired or was waived.`
      );
    }

    // 6. Fetch before/after condition reports from Handover Service for immutable snapshot
    let conditionReportSnapshot = null;
    try {
      conditionReportSnapshot = await handoverClient.getConditionReports(bookingId, correlationId);
    } catch (err) {
      logger.warn(`[ClaimService] Could not fetch condition reports from Handover: ${err.message}`);
    }

    const claimId = `CLM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const evidenceId = `EVD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const eventId = `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const claimedAmountPaise = toPaise(claimedAmount);
    const createdAt = clock.toISOString();

    const db = getSqlDb();

    // 7. Insert claim record in SQL
    db.prepare(`
      INSERT INTO claims (
        claimId, bookingId, claimantId, reason, claimedAmount, status, windowClosesAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?)
    `).run(
      claimId,
      bookingId,
      claimantId,
      reason,
      claimedAmountPaise,
      rentalCase.claimWindowClosesAt,
      createdAt,
      createdAt
    );

    // 8. Persist immutable evidence snapshot in MongoDB
    try {
      await ClaimEvidence.create({
        evidenceId,
        claimId,
        bookingId,
        photos: evidence.photos,
        notes: evidence.notes || undefined,
        conditionReportSnapshot: conditionReportSnapshot || undefined,
        addedBy: claimantId,
        createdAt: new Date(createdAt),
      });
    } catch (mongoErr) {
      logger.warn(`[ClaimService] Failed to persist ClaimEvidence to MongoDB: ${mongoErr.message}`);
    }

    // 9. Record timeline event in MongoDB
    try {
      await ClaimEvent.create({
        eventId,
        bookingId,
        claimId,
        eventType: 'ClaimSubmitted',
        actor: claimantId,
        actorRole: user.role === 'ADMIN' ? 'ADMIN' : 'OWNER',
        payload: {
          claimId,
          claimedAmount: toRupees(claimedAmountPaise),
          photoCount: evidence.photos.length,
        },
        correlationId,
        timestamp: new Date(createdAt),
      });
    } catch (evtErr) {
      logger.warn(`[ClaimService] Failed to persist ClaimEvent to MongoDB: ${evtErr.message}`);
    }

    // 10. Send notification to the renter
    await notificationClient.sendNotification({
      recipientId: rentalCase.renterId,
      bookingId,
      claimId,
      type: 'ClaimSubmitted',
      message: `Equipment damage claim for INR ${claimedAmount} has been submitted by the owner.`,
      correlationId,
    });

    return {
      claimId,
      bookingId,
      claimantId,
      reason,
      claimedAmount: toRupees(claimedAmountPaise),
      status: 'SUBMITTED',
      windowClosesAt: rentalCase.claimWindowClosesAt,
      createdAt,
    };
  }

  /**
   * Retrieves single claim by claimId.
   */
  async getClaim(claimId, user, correlationId = 'internal') {
    const db = getSqlDb();
    const row = db.prepare('SELECT * FROM claims WHERE claimId = ?').get(claimId);

    if (!row) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', `Damage claim '${claimId}' was not found.`);
    }

    const rentalCase = await caseService.getOrCreateRentalCase(row.bookingId, correlationId);

    // Participant authorization
    if (user && user.role !== 'ADMIN' && !user.isService) {
      if (user.id !== rentalCase.ownerId && user.id !== rentalCase.renterId) {
        throw new AppError(403, 'NOT_PARTICIPANT', 'You are not authorized to view this claim.');
      }
    }

    const decision = db.prepare('SELECT * FROM claim_decisions WHERE claimId = ?').get(claimId);

    return {
      claimId: row.claimId,
      bookingId: row.bookingId,
      claimantId: row.claimantId,
      reason: row.reason,
      claimedAmount: toRupees(row.claimedAmount),
      status: row.status,
      decision: decision
        ? {
            decisionId: decision.decisionId,
            decision: decision.decision,
            approvedAmount: toRupees(decision.approvedAmount),
            reason: decision.reason,
            decidedBy: decision.decidedBy,
            decidedAt: decision.decidedAt,
          }
        : null,
      windowClosesAt: row.windowClosesAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Lists claims with cursor pagination.
   */
  async listClaims({ bookingId, status, limit = 10, cursor = null, user }) {
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
        const [cursorDate, cursorId] = decoded.split('_');
        conditions.push('(createdAt < ? OR (createdAt = ? AND claimId < ?))');
        params.push(cursorDate, cursorDate, cursorId);
      } catch {
        // Ignored
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM claims
      ${whereClause}
      ORDER BY createdAt DESC, claimId DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(...params, pageSize + 1);
    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      const raw = `${last.createdAt}_${last.claimId}`;
      nextCursor = Buffer.from(raw).toString('base64');
    }

    return {
      items: items.map((r) => ({
        claimId: r.claimId,
        bookingId: r.bookingId,
        claimantId: r.claimantId,
        reason: r.reason,
        claimedAmount: toRupees(r.claimedAmount),
        status: r.status,
        windowClosesAt: r.windowClosesAt,
        createdAt: r.createdAt,
      })),
      hasMore,
      nextCursor,
    };
  }

  /**
   * Adds additional evidence photos/notes to an existing claim (Claimant only, SUBMITTED status only).
   */
  async addEvidenceItem({ claimId, photos = [], notes, user, correlationId = 'internal' }) {
    const db = getSqlDb();
    const claim = db.prepare('SELECT * FROM claims WHERE claimId = ?').get(claimId);

    if (!claim) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', `Claim '${claimId}' was not found.`);
    }

    if (user.role !== 'ADMIN' && user.id !== claim.claimantId) {
      throw new AppError(403, 'NOT_PARTICIPANT', 'Only the claimant or administrator can add evidence to this claim.');
    }

    if (claim.status !== 'SUBMITTED') {
      throw new AppError(409, 'INVALID_CLAIM_STATE', `Cannot add evidence: claim status is '${claim.status}'.`);
    }

    const evidenceId = `EVD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const eventId = `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const now = clock.toISOString();

    const createdEvidence = await ClaimEvidence.create({
      evidenceId,
      claimId,
      bookingId: claim.bookingId,
      photos: Array.isArray(photos) ? photos : [],
      notes: notes || undefined,
      addedBy: user.id,
      createdAt: new Date(now),
    });

    await ClaimEvent.create({
      eventId,
      bookingId: claim.bookingId,
      claimId,
      eventType: 'EvidenceItemAdded',
      actor: user.id,
      actorRole: user.role === 'ADMIN' ? 'ADMIN' : 'OWNER',
      payload: {
        evidenceId,
        photosAdded: photos.length,
      },
      correlationId,
      timestamp: new Date(now),
    });

    return {
      evidenceId,
      claimId,
      photos: createdEvidence.photos,
      notes: createdEvidence.notes,
      addedBy: user.id,
      createdAt: now,
    };
  }

  /**
   * Retrieves cursor-paginated timeline of events for a claim from MongoDB.
   */
  async getClaimEvents(claimId, { limit = 10, cursor = null, user, correlationId = 'internal' }) {
    const db = getSqlDb();
    const claim = db.prepare('SELECT * FROM claims WHERE claimId = ?').get(claimId);

    if (!claim) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', `Claim '${claimId}' was not found.`);
    }

    const rentalCase = await caseService.getOrCreateRentalCase(claim.bookingId, correlationId);
    if (user && user.role !== 'ADMIN' && !user.isService) {
      if (user.id !== rentalCase.ownerId && user.id !== rentalCase.renterId) {
        throw new AppError(403, 'NOT_PARTICIPANT', 'You are not authorized to view the event timeline for this claim.');
      }
    }

    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);
    const query = { claimId };

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorTime, cursorId] = decoded.split('_');
        query.$or = [
          { timestamp: { $lt: new Date(cursorTime) } },
          { timestamp: new Date(cursorTime), _id: { $lt: cursorId } },
        ];
      } catch {
        // Ignored
      }
    }

    const events = await ClaimEvent.find(query)
      .sort({ timestamp: -1, _id: -1 })
      .limit(pageSize + 1);

    const hasMore = events.length > pageSize;
    const paged = hasMore ? events.slice(0, pageSize) : events;

    let nextCursor = null;
    if (hasMore && paged.length > 0) {
      const last = paged[paged.length - 1];
      const raw = `${last.timestamp.toISOString()}_${last._id}`;
      nextCursor = Buffer.from(raw).toString('base64');
    }

    return {
      items: paged.map((e) => ({
        eventId: e.eventId,
        bookingId: e.bookingId,
        claimId: e.claimId,
        eventType: e.eventType,
        actor: e.actor,
        actorRole: e.actorRole,
        payload: e.payload,
        timestamp: e.timestamp,
      })),
      hasMore,
      nextCursor,
    };
  }
}

module.exports = new ClaimService();
