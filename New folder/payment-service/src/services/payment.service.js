const crypto = require('crypto');
const { getSqlDb } = require('../config/database');
const gatewayClient = require('../gateways');
const bookingClient = require('../clients/booking.client');
const eventService = require('./event.service');
const outboxService = require('./outbox.service');
const AppError = require('../utils/AppError');
const { toPaise, toRupees } = require('../utils/currency');
const logger = require('../utils/logger');

class PaymentService {
  /**
   * Initiates payment for an APPROVED booking.
   * Recomputes all amounts from the Booking snapshot.
   */
  async initiatePayment({
    bookingId,
    renterId,
    rentalAmount,
    deposit,
    currency = 'INR',
    user,
    correlationId = 'internal',
  }) {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }

    // 1. Fetch immutable snapshot from Booking Service
    const bookingRes = await bookingClient.getBookingDetails(bookingId, correlationId);
    const booking = bookingRes.data || bookingRes.booking || bookingRes;

    if (!booking || !booking.bookingId) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // 2. Validate participant authorization (caller must be renter)
    const expectedRenterId = booking.renterId;
    if (user && user.role !== 'ADMIN' && user.id !== expectedRenterId) {
      throw new AppError(403, 'ACCESS_DENIED', 'Caller is not the authorized renter for this booking.');
    }
    if (renterId && renterId !== expectedRenterId) {
      throw new AppError(403, 'ACCESS_DENIED', 'Provided renterId does not match the booking owner.');
    }

    // 3. Validate booking state machine status (must be APPROVED)
    if (booking.status !== 'APPROVED') {
      if (booking.status === 'PAID') {
        throw new AppError(409, 'INVALID_BOOKING_STATE', 'Booking is already confirmed and paid.');
      }
      throw new AppError(
        409,
        'INVALID_BOOKING_STATE',
        `Booking is in '${booking.status}' state. Only APPROVED bookings can initiate payment.`
      );
    }

    // 4. Verify payment deadline
    if (booking.paymentDeadline) {
      const deadline = new Date(booking.paymentDeadline);
      if (!isNaN(deadline.getTime()) && deadline < new Date()) {
        throw new AppError(
          409,
          'BOOKING_EXPIRED',
          'Payment deadline has expired. This booking can no longer be paid.'
        );
      }
    }

    // 5. Recompute amounts strictly from Booking snapshot
    const snapRentalPaise = toPaise(booking.rentalAmount ?? 0);
    const snapPlatformFeePaise = toPaise(booking.platformFee ?? 0);
    const snapDepositPaise = toPaise(booking.securityDeposit ?? 0);
    const snapTotalPaise = snapRentalPaise + snapPlatformFeePaise + snapDepositPaise;

    // Reject client amount mismatches
    if (rentalAmount !== undefined && rentalAmount !== null) {
      if (toPaise(rentalAmount) !== snapRentalPaise) {
        throw new AppError(400, 'INVALID_AMOUNT', 'rentalAmount does not match booking snapshot amount.');
      }
    }
    if (deposit !== undefined && deposit !== null) {
      if (toPaise(deposit) !== snapDepositPaise) {
        throw new AppError(400, 'INVALID_AMOUNT', 'Security deposit does not match booking snapshot amount.');
      }
    }

    const db = getSqlDb();

    // Check if a confirmed payment already exists in SQL ledger
    const existingConfirmed = db.prepare('SELECT paymentId FROM payments WHERE bookingId = ? AND status = ?').get(bookingId, 'CONFIRMED');
    if (existingConfirmed) {
      throw new AppError(409, 'INVALID_BOOKING_STATE', 'Booking is already paid and confirmed.');
    }

    // 6. Request gateway order creation
    const gatewayOrder = await gatewayClient.createOrder({
      amount: snapTotalPaise,
      currency: booking.currency || currency || 'INR',
      receipt: bookingId,
      notes: {
        bookingId,
        renterId: expectedRenterId,
      },
    });

    const paymentId = `PAY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    // 7. Persist to SQL ledger
    const insertStmt = db.prepare(`
      INSERT INTO payments (
        paymentId, bookingId, renterId, rentalAmount, platformFee, securityDeposit,
        totalAmount, currency, status, gateway, gatewayOrderId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      paymentId,
      bookingId,
      expectedRenterId,
      snapRentalPaise,
      snapPlatformFeePaise,
      snapDepositPaise,
      snapTotalPaise,
      booking.currency || currency || 'INR',
      'PENDING_VERIFICATION',
      gatewayClient.name,
      gatewayOrder.orderId || gatewayOrder.id,
      now,
      now
    );

    // 8. Record audit event in NoSQL document store
    await eventService.recordEvent({
      paymentId,
      bookingId,
      eventType: 'PaymentInitiated',
      actor: user?.id || expectedRenterId,
      entityId: paymentId,
      payload: {
        totalAmount: snapTotalPaise,
        gatewayOrderId: gatewayOrder.orderId,
      },
      correlationId,
    });

    return {
      paymentId,
      bookingId,
      status: 'PENDING_VERIFICATION',
      gatewayStatus: 'CREATED',
      gatewayOrderId: gatewayOrder.orderId,
      totalAmount: toRupees(snapTotalPaise),
      rentalAmount: toRupees(snapRentalPaise),
      platformFee: toRupees(snapPlatformFeePaise),
      securityDeposit: toRupees(snapDepositPaise),
      currency: booking.currency || 'INR',
      createdAt: now,
    };
  }

  /**
   * Verifies payment via client verification or gateway webhook.
   * Atomically transitions payment to CONFIRMED, holds deposit, writes outbox, and notifies Booking.
   */
  async verifyPayment({
    paymentId,
    gatewayTransactionReference,
    gatewayOrderId,
    signature,
    actor = 'system',
    correlationId = 'internal',
  }) {
    const db = getSqlDb();

    let payment = db.prepare('SELECT * FROM payments WHERE paymentId = ?').get(paymentId);
    if (!payment && gatewayOrderId) {
      payment = db.prepare('SELECT * FROM payments WHERE gatewayOrderId = ?').get(gatewayOrderId);
    }

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment record '${paymentId}' was not found.`);
    }

    // State machine: Idempotent replay if already CONFIRMED
    if (payment.status === 'CONFIRMED') {
      return {
        status: 'CONFIRMED',
        paymentId: payment.paymentId,
        bookingId: payment.bookingId,
        transactionReference: payment.transactionReference,
        alreadyVerified: true,
      };
    }

    // Illegal transition check
    if (payment.status === 'FAILED') {
      throw new AppError(409, 'INVALID_PAYMENT_STATE', 'Cannot verify a payment that has already failed.');
    }

    // Verify signature with Gateway adapter
    const verifiedOrderId = gatewayOrderId || payment.gatewayOrderId;
    const verifiedTxnRef = gatewayTransactionReference || `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    if (signature) {
      const isValid = gatewayClient.verifySignature(
        {
          orderId: verifiedOrderId,
          paymentId: verifiedTxnRef,
          signature,
        },
        process.env.GATEWAY_WEBHOOK_SECRET
      );

      if (!isValid) {
        throw new AppError(401, 'INVALID_SIGNATURE', 'Payment gateway verification signature is invalid.');
      }
    }

    const now = new Date().toISOString();
    const depositId = `DEP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Execute atomic state transition in SQL transaction
    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Mark payment CONFIRMED
      db.prepare(`
        UPDATE payments
        SET status = 'CONFIRMED', transactionReference = ?, gatewayPaymentId = ?, verifiedAt = ?, updatedAt = ?
        WHERE paymentId = ?
      `).run(verifiedTxnRef, verifiedTxnRef, now, now, payment.paymentId);

      // 2. Hold Security Deposit in SQL deposits table
      db.prepare(`
        INSERT OR REPLACE INTO deposits (
          depositId, bookingId, paymentId, renterId, depositAmount, heldAmount, status, paymentReference, heldAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'HELD', ?, ?, ?, ?)
      `).run(
        depositId,
        payment.bookingId,
        payment.paymentId,
        payment.renterId,
        payment.securityDeposit,
        payment.securityDeposit,
        verifiedTxnRef,
        now,
        now,
        now
      );

      // 3. Write outbox event for guaranteed downstream delivery
      outboxService.addEvent(db, {
        eventType: 'PaymentConfirmed',
        aggregateId: payment.bookingId,
        payload: {
          bookingId: payment.bookingId,
          paymentId: payment.paymentId,
          transactionReference: verifiedTxnRef,
          paidAt: now,
        },
      });

      db.exec('COMMIT');
    } catch (txnErr) {
      db.exec('ROLLBACK');
      logger.error(`[PaymentService] Transaction failed during payment verification: ${txnErr.message}`);
      throw txnErr;
    }

    // Record audit event in NoSQL store
    await eventService.recordEvent({
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      eventType: 'PaymentConfirmed',
      actor,
      entityId: payment.paymentId,
      payload: {
        transactionReference: verifiedTxnRef,
        depositId,
      },
      correlationId,
    });

    // Attempt direct downstream notification; outbox dispatcher retries if this throws
    try {
      await bookingClient.notifyPaymentConfirmed(
        payment.bookingId,
        {
          paymentId: payment.paymentId,
          transactionReference: verifiedTxnRef,
          paidAt: now,
        },
        correlationId
      );
    } catch (notifyErr) {
      logger.warn(`[PaymentService] Direct notification delayed for ${payment.bookingId}: ${notifyErr.message}`);
    }

    return {
      status: 'CONFIRMED',
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      transactionReference: verifiedTxnRef,
      depositId,
      depositStatus: 'HELD',
    };
  }

  /**
   * Processes gateway webhooks with HMAC-SHA256 signature verification.
   */
  async handleGatewayWebhook({ signature, body, rawBody, correlationId = 'webhook' }) {
    if (!signature) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Missing gateway signature header.');
    }

    const secret = process.env.GATEWAY_WEBHOOK_SECRET || 'agrirent_webhook_secret_key_2026_dev';
    const sigFromRaw = typeof rawBody === 'string' && rawBody.length > 0
      ? crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
      : null;
    const sigFromBody = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

    let isValid = false;
    try {
      if (sigFromRaw && signature.length === sigFromRaw.length && crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(sigFromRaw, 'utf8'))) {
        isValid = true;
      } else if (signature.length === sigFromBody.length && crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(sigFromBody, 'utf8'))) {
        isValid = true;
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'HMAC-SHA256 webhook signature check failed.');
    }

    const event = body.event || 'payment.captured';
    const paymentEntity = body.payload?.payment?.entity || {};
    const orderId = paymentEntity.order_id;
    const paymentReference = paymentEntity.id;

    const db = getSqlDb();
    const payment = db.prepare('SELECT * FROM payments WHERE gatewayOrderId = ?').get(orderId);

    if (!payment) {
      return { status: 'IGNORED', message: `No payment found for order: ${orderId}` };
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      return await this.verifyPayment({
        paymentId: payment.paymentId,
        gatewayTransactionReference: paymentReference,
        gatewayOrderId: orderId,
        actor: 'GATEWAY_WEBHOOK',
        correlationId,
      });
    }

    if (event === 'payment.failed') {
      if (payment.status !== 'CONFIRMED') {
        const now = new Date().toISOString();
        const reason = paymentEntity.error_description || 'Payment failed at gateway';
        db.prepare(`UPDATE payments SET status = 'FAILED', failedReason = ?, updatedAt = ? WHERE paymentId = ?`).run(reason, now, payment.paymentId);

        await eventService.recordEvent({
          paymentId: payment.paymentId,
          bookingId: payment.bookingId,
          eventType: 'PaymentFailed',
          actor: 'GATEWAY_WEBHOOK',
          entityId: payment.paymentId,
          payload: { reason },
          correlationId,
        });

        await bookingClient.notifyPaymentFailed(payment.bookingId, { reason }, correlationId);
      }
      return { status: 'RECORDED_FAILURE', paymentId: payment.paymentId };
    }

    return { status: 'RECEIVED', event };
  }

  /**
   * Retrieves payment record by ID.
   */
  async getPayment(paymentId) {
    if (!paymentId) {
      throw new AppError(400, 'INVALID_INPUT', 'paymentId is required.');
    }

    const db = getSqlDb();
    const payment = db.prepare('SELECT * FROM payments WHERE paymentId = ?').get(paymentId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment '${paymentId}' not found.`);
    }

    return {
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      renterId: payment.renterId,
      status: payment.status,
      totalAmount: toRupees(payment.totalAmount),
      rentalAmount: toRupees(payment.rentalAmount),
      platformFee: toRupees(payment.platformFee),
      securityDeposit: toRupees(payment.securityDeposit),
      refundedAmount: toRupees(payment.refundedAmount),
      currency: payment.currency,
      gateway: payment.gateway,
      gatewayOrderId: payment.gatewayOrderId,
      transactionReference: payment.transactionReference,
      verifiedAt: payment.verifiedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * List payments with cursor-based pagination and stable ordering.
   */
  async listPayments({ bookingId, status, limit = 10, cursor = null }) {
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
        const decoded = Buffer.from(cursor, 'base64').toString('ascii');
        const [cursorCreatedAt, cursorId] = decoded.split('|');
        conditions.push('(createdAt < ? OR (createdAt = ? AND paymentId < ?))');
        params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
      } catch {
        // Fallback or ignore invalid cursor
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM payments
      ${whereClause}
      ORDER BY createdAt DESC, paymentId DESC
      LIMIT ?
    `;

    params.push(pageSize + 1);
    const rows = db.prepare(query).all(...params);

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(`${lastItem.createdAt}|${lastItem.paymentId}`).toString('base64');
    }

    return {
      items: items.map((p) => ({
        paymentId: p.paymentId,
        bookingId: p.bookingId,
        renterId: p.renterId,
        status: p.status,
        totalAmount: toRupees(p.totalAmount),
        rentalAmount: toRupees(p.rentalAmount),
        platformFee: toRupees(p.platformFee),
        securityDeposit: toRupees(p.securityDeposit),
        refundedAmount: toRupees(p.refundedAmount),
        currency: p.currency,
        createdAt: p.createdAt,
      })),
      hasMore,
      nextCursor,
    };
  }

  /**
   * Retrieves payment & deposit status for Handover and downstream services.
   */
  async getPaymentStatus(bookingId) {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }

    const db = getSqlDb();
    const payment = db.prepare('SELECT * FROM payments WHERE bookingId = ? ORDER BY createdAt DESC LIMIT 1').get(bookingId);

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', `No payment records found for booking '${bookingId}'.`);
    }

    const deposit = db.prepare('SELECT * FROM deposits WHERE bookingId = ?').get(bookingId);

    return {
      bookingId,
      paymentId: payment.paymentId,
      paymentStatus: payment.status,
      depositStatus: deposit ? deposit.status : 'NONE',
      paid: payment.status === 'CONFIRMED',
      totalAmount: toRupees(payment.totalAmount),
      heldDeposit: deposit ? toRupees(deposit.heldAmount) : 0,
      currency: payment.currency,
      transactionReference: payment.transactionReference || null,
      verifiedAt: payment.verifiedAt || null,
    };
  }
}

module.exports = new PaymentService();
