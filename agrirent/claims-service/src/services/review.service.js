const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const caseService = require('./case.service');
const bookingClient = require('../clients/booking.client');
const ClaimEvent = require('../models/ClaimEvent');
const clock = require('../utils/clock');
const AppError = require('../utils/AppError');

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class ReviewService {
  /**
   * Submits peer review for completed rental.
   */
  async submitReview({ bookingId, reviewerId, targetUserId, rating, feedback, user, correlationId = 'internal' }) {
    // 1. Rating bounds check (integer 1-5)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(400, 'INVALID_RATING', 'Rating must be an integer between 1 and 5.');
    }

    // 2. Fetch booking and rental case
    const rentalCase = await caseService.getOrCreateRentalCase(bookingId, correlationId);

    // 3. Authorization: caller must be a participant
    if (user.role !== 'ADMIN' && reviewerId !== rentalCase.renterId && reviewerId !== rentalCase.ownerId) {
      throw new AppError(403, 'NOT_PARTICIPANT', 'Only booking participants may submit reviews.');
    }

    // 4. Target validation: must be the other participant
    const expectedTarget = reviewerId === rentalCase.renterId ? rentalCase.ownerId : rentalCase.renterId;
    if (targetUserId === reviewerId || targetUserId !== expectedTarget) {
      throw new AppError(
        400,
        'INVALID_REVIEW_TARGET',
        `Review target must be the other rental participant (${expectedTarget}).`
      );
    }

    // 5. Booking state validation: must be RETURNED or later
    const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
    if (!booking || (booking.status !== 'RETURNED' && booking.status !== 'COMPLETED')) {
      throw new AppError(
        409,
        'INVALID_BOOKING_STATE',
        `Reviews can only be submitted after equipment return. Current status is '${booking?.status || 'UNKNOWN'}'.`
      );
    }

    // 6. Review window check: REVIEW_WINDOW_DAYS
    const reviewWindowDays = parseInt(process.env.REVIEW_WINDOW_DAYS, 10) || 14;
    const returnedAt = new Date(rentalCase.returnedAt).getTime();
    const reviewDeadline = new Date(returnedAt + reviewWindowDays * 24 * 60 * 60 * 1000);

    if (clock.now() > reviewDeadline) {
      throw new AppError(
        409,
        'REVIEW_WINDOW_CLOSED',
        `The review window for booking '${bookingId}' closed on ${reviewDeadline.toISOString()}.`
      );
    }

    const db = getSqlDb();

    // 7. Check if review was already submitted
    const existing = db
      .prepare('SELECT * FROM reviews WHERE bookingId = ? AND reviewerId = ?')
      .get(bookingId, reviewerId);
    if (existing) {
      throw new AppError(
        409,
        'REVIEW_ALREADY_SUBMITTED',
        'You have already submitted a review for this booking.'
      );
    }

    const reviewId = `REV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = clock.toISOString();
    const sanitizedFeedback = escapeHtml(feedback);

    try {
      db.prepare(`
        INSERT INTO reviews (
          reviewId, bookingId, reviewerId, targetUserId, rating, feedback, status, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', ?)
      `).run(
        reviewId,
        bookingId,
        reviewerId,
        targetUserId,
        rating,
        sanitizedFeedback,
        now
      );
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new AppError(
          409,
          'REVIEW_ALREADY_SUBMITTED',
          'You have already submitted a review for this booking.'
        );
      }
      throw err;
    }

    // 8. Record event in MongoDB
    try {
      await ClaimEvent.create({
        eventId: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        bookingId,
        eventType: 'ReviewSubmitted',
        actor: reviewerId,
        actorRole: reviewerId === rentalCase.renterId ? 'RENTER' : 'OWNER',
        payload: {
          reviewId,
          targetUserId,
          rating,
        },
        correlationId,
        timestamp: new Date(now),
      });
    } catch {}

    return {
      reviewId,
      bookingId,
      reviewerId,
      targetUserId,
      rating,
      feedback: sanitizedFeedback,
      status: 'PUBLISHED',
      createdAt: now,
    };
  }

  /**
   * Retrieves review by reviewId.
   */
  async getReview(reviewId) {
    const db = getSqlDb();
    const row = db.prepare('SELECT * FROM reviews WHERE reviewId = ?').get(reviewId);

    if (!row) {
      throw new AppError(404, 'REVIEW_NOT_FOUND', `Review '${reviewId}' was not found.`);
    }

    return {
      reviewId: row.reviewId,
      bookingId: row.bookingId,
      reviewerId: row.reviewerId,
      targetUserId: row.targetUserId,
      rating: row.rating,
      feedback: row.feedback,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  /**
   * Lists reviews with cursor pagination.
   */
  async listReviews({ targetUserId, bookingId, limit = 10, cursor = null }) {
    const db = getSqlDb();
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const conditions = [];
    const params = [];

    if (targetUserId) {
      conditions.push('targetUserId = ?');
      params.push(targetUserId);
    }

    if (bookingId) {
      conditions.push('bookingId = ?');
      params.push(bookingId);
    }

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorDate, cursorId] = decoded.split('_');
        conditions.push('(createdAt < ? OR (createdAt = ? AND reviewId < ?))');
        params.push(cursorDate, cursorDate, cursorId);
      } catch {}
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM reviews
      ${whereClause}
      ORDER BY createdAt DESC, reviewId DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(...params, pageSize + 1);
    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      const raw = `${last.createdAt}_${last.reviewId}`;
      nextCursor = Buffer.from(raw).toString('base64');
    }

    return {
      items: items.map((r) => ({
        reviewId: r.reviewId,
        bookingId: r.bookingId,
        reviewerId: r.reviewerId,
        targetUserId: r.targetUserId,
        rating: r.rating,
        feedback: r.feedback,
        status: r.status,
        createdAt: r.createdAt,
      })),
      hasMore,
      nextCursor,
    };
  }

  /**
   * Retrieves aggregated review summary (rating average, count) for a user.
   */
  async getReviewSummary(userId) {
    const db = getSqlDb();
    const stats = db
      .prepare(`
        SELECT COUNT(*) as totalReviews, AVG(rating) as averageRating
        FROM reviews
        WHERE targetUserId = ?
      `)
      .get(userId);

    const count = stats?.totalReviews || 0;
    const avg = count > 0 && stats?.averageRating ? Number(stats.averageRating.toFixed(2)) : 0;

    return {
      userId,
      averageRating: avg,
      reviewCount: count,
      calculatedAt: clock.toISOString(),
    };
  }
}

module.exports = new ReviewService();
