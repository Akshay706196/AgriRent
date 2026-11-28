const AppError = require('../utils/AppError');
const clock = require('../utils/clock');
const { toRupees } = require('../utils/currency');
const { getSqlDb } = require('../config/database');

/**
 * Calculates due timestamp at 00:00:00 in BUSINESS_TIMEZONE for the given booking end date.
 * Booking end date is exclusive under half-open [startDate, endDate) convention.
 *
 * @param {Date|string} endDate Booking end date
 * @param {string} timezone Target business timezone (default: Asia/Kolkata)
 * @returns {Date} JavaScript Date representing 00:00 in the business timezone
 */
function calculateDueAt(endDate, timezone = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata') {
  const dateObj = new Date(endDate);
  if (isNaN(dateObj.getTime())) {
    throw new AppError(400, 'INVALID_BOOKING_DATE', 'Invalid booking endDate format.');
  }

  // Format date part YYYY-MM-DD in the business timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(dateObj); // "YYYY-MM-DD"

  // In Asia/Kolkata (UTC+05:30), offset is -330 minutes
  // We compute the UTC time corresponding to midnight in this timezone:
  const offsetMinutes = timezone === 'Asia/Kolkata' ? 330 : 0;
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const localMidnightMs = utcMidnight - (offsetMinutes * 60 * 1000);

  return new Date(localMidnightMs);
}

/**
 * Converts minutes to ISO 8601 duration string (e.g. "PT48H0M").
 */
function formatIsoDuration(totalMinutes) {
  if (totalMinutes <= 0) return 'PT0M';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `PT${hours}H${minutes}M`;
  if (hours > 0) return `PT${hours}H`;
  return `PT${minutes}M`;
}

class LateFineService {
  /**
   * Late Fine Assessment Formula:
   * 1. dueAt = booking endDate at 00:00 in BUSINESS_TIMEZONE (exclusive end date convention)
   * 2. overdueMs = actualReturn - (dueAt + GRACE_PERIOD_MINUTES)
   * 3. if overdueMs <= 0 -> fine = 0
   * 4. else overdueDays = Math.ceil(overdueMs / 24h);
   *    fine = overdueDays * LATE_FINE_DAILY_RATE (in integer paise);
   *    capped at booking.securityDeposit if LATE_FINE_CAP_AT_DEPOSIT=true.
   */
  calculateFine({ booking, actualReturnDate }) {
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking record is required for fine calculation.');
    }

    const timezone = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
    const graceMinutes = parseInt(process.env.GRACE_PERIOD_MINUTES, 10) || 30;
    const isCapEnabled = process.env.LATE_FINE_CAP_AT_DEPOSIT !== 'false';

    const dueAt = calculateDueAt(booking.endDate, timezone);
    const returnTime = actualReturnDate ? new Date(actualReturnDate) : clock.now();

    if (isNaN(returnTime.getTime())) {
      throw new AppError(400, 'INVALID_RETURN_TIME', 'Invalid return timestamp format.');
    }

    const thresholdMs = dueAt.getTime() + (graceMinutes * 60 * 1000);
    const overdueMs = returnTime.getTime() - thresholdMs;

    let overdueMinutes = 0;
    let overdueDays = 0;
    let finePaise = 0;
    let depositCapApplied = false;

    // Daily rate in paise (default: 300000 paise = 3000 INR, or 1.5x pricePerDay)
    const dailyRatePaise = parseInt(process.env.LATE_FINE_DAILY_RATE, 10) ||
      (booking.pricePerDaySnapshot ? Math.round(booking.pricePerDaySnapshot * 100 * 1.5) : 300000);

    if (overdueMs > 0) {
      overdueMinutes = Math.ceil(overdueMs / (60 * 1000));
      overdueDays = Math.ceil(overdueMs / (24 * 60 * 60 * 1000));

      const uncappedFinePaise = overdueDays * dailyRatePaise;

      // Check security deposit cap
      const depositPaise = booking.securityDeposit ? Math.round(booking.securityDeposit * 100) : null;

      if (isCapEnabled && depositPaise !== null && uncappedFinePaise > depositPaise) {
        finePaise = depositPaise;
        depositCapApplied = true;
      } else {
        finePaise = uncappedFinePaise;
        depositCapApplied = false;
      }
    }

    return {
      bookingId: booking.bookingId || booking.id,
      dueDate: dueAt.toISOString(),
      actualReturn: returnTime.toISOString(),
      gracePeriodMinutes: graceMinutes,
      overdueDuration: formatIsoDuration(overdueMinutes),
      overdueMinutes,
      overdueDays,
      dailyRatePaise,
      dailyRate: toRupees(dailyRatePaise),
      fineAmountPaise: finePaise,
      fineAmount: toRupees(finePaise),
      depositCapApplied,
      currency: booking.currency || 'INR',
      calculatedAt: clock.toISOString(),
    };
  }

  /**
   * Retrieves persistent late fine from SQL table or generates preview calculation.
   * If booking is already returned, returns the persisted fine.
   * If returnTime query param is provided before return, returns preview without persisting.
   */
  async getOrCalculateLateFine(bookingId, previewReturnTime = null, bookingDetails = null) {
    const db = getSqlDb();

    // 1. Check if fine was already persisted in SQL
    const persisted = db.prepare('SELECT * FROM late_fines WHERE bookingId = ?').get(bookingId);
    if (persisted && !previewReturnTime) {
      return {
        fineId: persisted.fineId,
        bookingId: persisted.bookingId,
        returnId: persisted.returnId,
        dueDate: persisted.dueDate,
        actualReturn: persisted.actualReturn,
        gracePeriodMinutes: persisted.gracePeriodMinutes,
        overdueDuration: persisted.overdueDuration,
        overdueMinutes: persisted.overdueMinutes,
        overdueDays: persisted.overdueDays,
        dailyRate: toRupees(persisted.dailyRate),
        fineAmount: toRupees(persisted.fineAmount),
        depositCapApplied: Boolean(persisted.depositCapApplied),
        currency: persisted.currency,
        status: persisted.status,
        calculatedAt: persisted.calculatedAt,
        createdAt: persisted.createdAt,
      };
    }

    // 2. Preview mode calculation
    if (!bookingDetails) {
      const bookingClient = require('../clients/booking.client');
      bookingDetails = await bookingClient.getBookingDetails(bookingId);
    }

    const calcResult = this.calculateFine({
      booking: bookingDetails,
      actualReturnDate: previewReturnTime || clock.now(),
    });

    return {
      ...calcResult,
      status: 'PREVIEW',
      preview: true,
    };
  }
}

module.exports = {
  lateFineService: new LateFineService(),
  calculateDueAt,
  formatIsoDuration,
};
