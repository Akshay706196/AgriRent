const { getSqlDb } = require('../config/database');
const bookingClient = require('../clients/booking.client');
const paymentClient = require('../clients/payment.client');
const handoverClient = require('../clients/handover.client');
const clock = require('../utils/clock');
const { toPaise, toRupees } = require('../utils/currency');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class CaseService {
  /**
   * Retrieves or creates a local rental case snapshot in SQL.
   * Fetches upstream details from Booking, Payment, and Handover on first contact.
   */
  async getOrCreateRentalCase(bookingId, correlationId = 'internal') {
    const db = getSqlDb();

    // 1. Check local SQL snapshot
    const existing = db.prepare('SELECT * FROM rental_cases WHERE bookingId = ?').get(bookingId);
    if (existing) {
      return this._formatCase(existing);
    }

    // 2. Fetch authoritative booking from Booking Service
    const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // 3. Fetch late fine from Handover Service (returns 0 if on time or not returned yet)
    let lateFinePaise = 0;
    try {
      const lateFineRes = await handoverClient.getLateFine(bookingId, correlationId);
      if (lateFineRes && lateFineRes.fineAmount !== undefined) {
        lateFinePaise = toPaise(lateFineRes.fineAmount);
      }
    } catch (err) {
      logger.warn(`[CaseService] Could not fetch late fine for ${bookingId}: ${err.message}`);
    }

    // 4. Fetch security deposit held from Payment Service or Booking snapshot
    let depositHeldPaise = toPaise(booking.securityDeposit || 0);
    try {
      const paymentStatus = await paymentClient.getPaymentStatus(bookingId, correlationId);
      if (paymentStatus && paymentStatus.heldDeposit !== undefined) {
        depositHeldPaise = toPaise(paymentStatus.heldDeposit);
      }
    } catch (err) {
      logger.warn(`[CaseService] Could not fetch payment status for ${bookingId}: ${err.message}`);
    }

    const rentalAmountPaise = toPaise(booking.rentalAmount || 0);
    const platformFeePaise = toPaise(booking.platformFee || 0);

    const returnedAt = booking.returnedAt ? new Date(booking.returnedAt).toISOString() : clock.toISOString();
    const claimWindowHours = parseInt(process.env.CLAIM_WINDOW_HOURS, 10) || 48;
    const returnedDate = new Date(returnedAt);
    const claimWindowClosesAt = new Date(returnedDate.getTime() + claimWindowHours * 60 * 60 * 1000).toISOString();

    const now = clock.toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO rental_cases (
        bookingId, renterId, ownerId, returnedAt, lateFineAmount, depositHeld,
        rentalAmount, platformFee, claimWindowClosesAt, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `).run(
      bookingId,
      booking.renterId,
      booking.ownerId,
      returnedAt,
      lateFinePaise,
      depositHeldPaise,
      rentalAmountPaise,
      platformFeePaise,
      claimWindowClosesAt,
      now,
      now
    );

    const created = db.prepare('SELECT * FROM rental_cases WHERE bookingId = ?').get(bookingId);
    return this._formatCase(created);
  }

  /**
   * Formats database row to entity with Rupee representation.
   */
  _formatCase(row) {
    if (!row) return null;
    const now = clock.now();
    const windowClosed = Boolean(row.waivedAt) || now > new Date(row.claimWindowClosesAt);

    return {
      bookingId: row.bookingId,
      renterId: row.renterId,
      ownerId: row.ownerId,
      returnedAt: row.returnedAt,
      lateFineAmount: toRupees(row.lateFineAmount),
      lateFineAmountPaise: row.lateFineAmount,
      depositHeld: toRupees(row.depositHeld),
      depositHeldPaise: row.depositHeld,
      rentalAmount: toRupees(row.rentalAmount),
      rentalAmountPaise: row.rentalAmount,
      platformFee: toRupees(row.platformFee),
      platformFeePaise: row.platformFee,
      claimWindowClosesAt: row.claimWindowClosesAt,
      waivedAt: row.waivedAt,
      status: row.status,
      windowClosed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Retrieves existing rental case or throws 404.
   */
  getRentalCase(bookingId) {
    const db = getSqlDb();
    const row = db.prepare('SELECT * FROM rental_cases WHERE bookingId = ?').get(bookingId);
    if (!row) {
      throw new AppError(404, 'CASE_NOT_FOUND', `Rental case for booking '${bookingId}' was not found.`);
    }
    return this._formatCase(row);
  }
}

module.exports = new CaseService();
