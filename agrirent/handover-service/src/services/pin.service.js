const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const AppError = require('../utils/AppError');
const clock = require('../utils/clock');
const { generatePin, hashPin, verifyPin } = require('../utils/pin');
const bookingClient = require('../clients/booking.client');
const paymentClient = require('../clients/payment.client');
const notificationClient = require('../clients/notification.client');
const eventService = require('./event.service');
const logger = require('../utils/logger');

class PinService {
  /**
   * Generates a new 6-digit PIN for Handover or Return.
   * Enforces participant authorization, booking state, payment confirmation, and hourly generation limits.
   */
  async generatePinForBooking({
    bookingId,
    type, // 'HANDOVER' | 'RETURN'
    user,
    correlationId = 'internal',
  }) {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }

    const db = getSqlDb();

    // 1. Fetch authoritative booking details from Booking Service
    const booking = await bookingClient.getBookingDetails(bookingId, correlationId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // 2. Caller Authorization: Only RENTER or internal service/admin can generate PINs
    const isRenter = user && (user.id === booking.renterId);
    const isAdminOrService = user && (user.role === 'ADMIN' || user.isService);

    if (!isRenter && !isAdminOrService) {
      throw new AppError(
        403,
        'UNAUTHORIZED_USER',
        'Only the renter associated with this booking is authorized to generate PINs.'
      );
    }

    // 3. Validate booking lifecycle & payment status
    if (type === 'HANDOVER') {
      if (booking.status !== 'PAID') {
        throw new AppError(
          409,
          'INVALID_BOOKING_STATE',
          `Handover PIN cannot be generated for booking in '${booking.status}' status. Booking must be PAID.`
        );
      }

      // Verify payment with Payment Service
      const paymentStatus = await paymentClient.getPaymentStatus(bookingId, correlationId);
      if (!paymentStatus || paymentStatus.paymentStatus !== 'CONFIRMED') {
        throw new AppError(
          409,
          'PAYMENT_NOT_CONFIRMED',
          'Payment has not been confirmed for this booking. Handover PIN cannot be issued.'
        );
      }
    } else if (type === 'RETURN') {
      if (booking.status !== 'IN_RENTAL') {
        throw new AppError(
          409,
          'BOOKING_NOT_IN_RENTAL',
          `Return PIN cannot be generated for booking in '${booking.status}' status. Booking must be IN_RENTAL.`
        );
      }
    }

    // 4. Rate-limit generations per booking per hour
    const maxPerHour = parseInt(process.env.MAX_PIN_GENERATIONS_PER_HOUR, 10) || 5;
    const oneHourAgo = new Date(clock.now().getTime() - 60 * 60 * 1000).toISOString();
    const countRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM pins
      WHERE bookingId = ? AND type = ? AND createdAt >= ?
    `).get(bookingId, type, oneHourAgo);

    if (countRow && countRow.cnt >= maxPerHour) {
      throw new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Maximum PIN generation limit of ${maxPerHour} per hour exceeded for this booking. Please try again later.`
      );
    }

    // 5. Generate secure 6-digit PIN and HMAC hash
    const rawPin = generatePin();
    const hashedPin = hashPin(rawPin);
    const pinId = `PIN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const nowIso = clock.toISOString();

    const ttlMinutes = parseInt(process.env.PIN_TTL_MINUTES, 10) || 30;
    const expiresAt = new Date(clock.now().getTime() + ttlMinutes * 60 * 1000).toISOString();
    const maxAttempts = parseInt(process.env.MAX_PIN_ATTEMPTS, 10) || 3;

    // 6. SQL Transaction: Supersede active PIN and insert new active PIN
    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      // Supersede any existing active PIN for this booking and type
      db.prepare(`
        UPDATE pins
        SET status = 'SUPERSEDED', updatedAt = ?
        WHERE bookingId = ? AND type = ? AND status = 'ACTIVE'
      `).run(nowIso, bookingId, type);

      // Insert new ACTIVE pin
      db.prepare(`
        INSERT INTO pins (
          pinId, bookingId, type, hashedPin, status, deliveryStatus, attempts, maxAttempts, expiresAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, 'ACTIVE', 'DELIVERED', 0, ?, ?, ?, ?)
      `).run(pinId, bookingId, type, hashedPin, maxAttempts, expiresAt, nowIso, nowIso);

      db.exec('COMMIT');
    } catch (dbErr) {
      try { db.exec('ROLLBACK'); } catch {}
      throw dbErr;
    }

    // 7. Pluggable notification dispatch (deliberately logs without plaintext PIN)
    await notificationClient.sendPinNotification({
      recipientId: booking.renterId,
      bookingId,
      pinType: type,
      pin: rawPin,
      correlationId,
    });

    // 8. Record audit trail in MongoDB (NEVER plaintext PIN)
    await eventService.recordEvent({
      bookingId,
      eventType: 'PinGenerated',
      actor: user ? user.id : 'SYSTEM',
      actorRole: user ? user.role : 'RENTER',
      pinId,
      pinType: type,
      payload: {
        pinId,
        expiresAt,
        ttlMinutes,
      },
      correlationId,
    });

    // 9. Response formulation
    const responseData = {
      pinId,
      deliveryStatus: 'DELIVERED',
      expiresAt,
    };

    if (process.env.NODE_ENV !== 'production' && process.env.DEV_EXPOSE_PIN === 'true') {
      responseData.dev_pin = rawPin;
    }

    return responseData;
  }

  /**
   * Validates submitted PIN, manages attempts count, and enforces locking.
   * Attempt counts and locks are persisted immediately outside the business transaction.
   */
  async checkAndValidatePin({
    bookingId,
    type,
    submittedPin,
    actorId,
    correlationId = 'internal',
  }) {
    const db = getSqlDb();

    // 1. Fetch most recent PIN record for this booking & type
    const pin = db.prepare(`
      SELECT * FROM pins
      WHERE bookingId = ? AND type = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `).get(bookingId, type);

    if (!pin) {
      throw new AppError(404, 'PIN_NOT_FOUND', `No ${type} PIN was issued for booking '${bookingId}'.`);
    }

    // 2. State validations
    if (pin.status === 'USED') {
      throw new AppError(409, 'PIN_ALREADY_USED', 'This PIN has already been verified and used.');
    }

    if (pin.status === 'LOCKED') {
      throw new AppError(423, 'PIN_LOCKED', 'This PIN has been locked due to too many failed attempts. Please generate a new PIN.');
    }

    if (pin.status === 'SUPERSEDED') {
      throw new AppError(409, 'PIN_EXPIRED', 'This PIN has been superseded by a newly issued PIN.');
    }

    const now = clock.now();
    const expiry = new Date(pin.expiresAt);

    if (pin.status === 'EXPIRED' || now > expiry) {
      if (pin.status !== 'EXPIRED') {
        db.prepare(`UPDATE pins SET status = 'EXPIRED', updatedAt = ? WHERE pinId = ?`).run(now.toISOString(), pin.pinId);
        await eventService.recordEvent({
          bookingId,
          eventType: 'PinExpired',
          actor: actorId,
          pinId: pin.pinId,
          pinType: type,
          correlationId,
        });
      }
      throw new AppError(409, 'PIN_EXPIRED', 'This PIN has expired. Please request a new PIN.');
    }

    // 3. Constant-time timing-safe comparison
    const isMatch = verifyPin(submittedPin, pin.hashedPin);

    if (!isMatch) {
      const updatedAttempts = pin.attempts + 1;
      const nowIso = now.toISOString();

      if (updatedAttempts >= pin.maxAttempts) {
        db.prepare(`
          UPDATE pins SET attempts = ?, status = 'LOCKED', updatedAt = ? WHERE pinId = ?
        `).run(updatedAttempts, nowIso, pin.pinId);

        await eventService.recordEvent({
          bookingId,
          eventType: 'PinLocked',
          actor: actorId,
          pinId: pin.pinId,
          pinType: type,
          payload: { attempts: updatedAttempts, maxAttempts: pin.maxAttempts },
          correlationId,
        });

        throw new AppError(
          423,
          'PIN_LOCKED',
          `PIN has been locked after ${pin.maxAttempts} incorrect attempts. A new PIN must be generated.`
        );
      } else {
        db.prepare(`
          UPDATE pins SET attempts = ?, updatedAt = ? WHERE pinId = ?
        `).run(updatedAttempts, nowIso, pin.pinId);

        await eventService.recordEvent({
          bookingId,
          eventType: 'PinAttemptFailed',
          actor: actorId,
          pinId: pin.pinId,
          pinType: type,
          payload: { attempts: updatedAttempts, maxAttempts: pin.maxAttempts },
          correlationId,
        });

        throw new AppError(
          422,
          'INVALID_PIN',
          `Incorrect verification PIN. Attempt ${updatedAttempts} of ${pin.maxAttempts}.`
        );
      }
    }

    // 4. Return valid pin
    return pin;
  }
}

module.exports = new PinService();
