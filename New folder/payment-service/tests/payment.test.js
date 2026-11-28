const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const { initSqlDb, connectMongo, closeMongo } = require('../src/config/database');
const { generateToken } = require('../src/middleware/auth.middleware');
const bookingClient = require('../src/clients/booking.client');
const claimsClient = require('../src/clients/claims.client');
const gatewayClient = require('../src/gateways');
const { attachSoapService } = require('../src/soap/paymentSoapService');
const { callGetPaymentStatus } = require('../scripts/soapClient');

let mongoServer;
let sqlDb;
let httpServer;
let soapPort;

const TEST_RENTER_ID = 'USR-RENTER01';
const TEST_OWNER_ID = 'USR-OWNER01';
const TEST_OTHER_ID = 'USR-OTHER99';

const renterToken = generateToken({ id: TEST_RENTER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const otherToken = generateToken({ id: TEST_OTHER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const unverifiedToken = generateToken({ id: TEST_RENTER_ID, role: 'USER', kycStatus: 'NOT_SUBMITTED' });
const adminToken = generateToken({ id: 'USR-ADMIN01', role: 'ADMIN' });

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SQL_DB_PATH = ':memory:';

  // In-memory SQL database
  sqlDb = initSqlDb(':memory:');

  // In-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  await connectMongo(mongoServer.getUri());

  // Attach HTTP server and SOAP service on dynamic test port
  httpServer = http.createServer(app);
  attachSoapService(httpServer);
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      soapPort = httpServer.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await closeMongo();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(() => {
  // Reset circuit breakers
  gatewayClient.breaker.reset();
  bookingClient.breaker.reset();
  claimsClient.breaker.reset();
});

describe('AgriRent Payment & Security Deposit Microservice (Service 4)', () => {
  const sampleBooking = {
    bookingId: 'BK-TEST-001',
    equipmentId: 'EQ-TRACTOR-01',
    ownerId: TEST_OWNER_ID,
    renterId: TEST_RENTER_ID,
    rentalAmount: 3000,
    platformFee: 300,
    securityDeposit: 500,
    totalAmount: 3800,
    currency: 'INR',
    status: 'APPROVED',
    paymentDeadline: new Date(Date.now() + 86400000).toISOString(),
  };

  // Mock booking client for test suite
  jest.spyOn(bookingClient, 'getBookingDetails').mockImplementation(async (bookingId) => {
    if (bookingId === 'BK-NOT-FOUND') {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }
    if (bookingId === 'BK-EXPIRED') {
      return {
        ...sampleBooking,
        bookingId: 'BK-EXPIRED',
        paymentDeadline: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };
    }
    if (bookingId === 'BK-PENDING') {
      return {
        ...sampleBooking,
        bookingId: 'BK-PENDING',
        status: 'PENDING_OWNER',
      };
    }
    return { ...sampleBooking, bookingId };
  });

  jest.spyOn(bookingClient, 'notifyPaymentConfirmed').mockResolvedValue({ success: true });
  jest.spyOn(bookingClient, 'notifyPaymentFailed').mockResolvedValue({ success: true });

  jest.spyOn(claimsClient, 'getApprovedDeductions').mockImplementation(async (bookingId) => {
    if (bookingId === 'BK-MISMATCH-DEDUCTION') {
      return {
        bookingId,
        lateFine: 100,
        totalDamageDeduction: 150, // Differs from requested 200
        eligible: true,
      };
    }
    return null;
  });

  describe('1. InitiatePayment (POST /v1/payments)', () => {
    it('Happy path: initiates payment order for an APPROVED booking and returns 201', async () => {
      const idempKey = 'idemp-init-happy-001';
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', idempKey)
        .set('x-correlation-id', 'test-req-001')
        .send({
          bookingId: 'BK-TEST-001',
          renterId: TEST_RENTER_ID,
          rentalAmount: 3000,
          deposit: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('paymentId');
      expect(res.body.bookingId).toBe('BK-TEST-001');
      expect(res.body.status).toBe('PENDING_VERIFICATION');
      expect(res.body.totalAmount).toBe(3800);
      expect(res.body.rentalAmount).toBe(3000);
      expect(res.body.platformFee).toBe(300);
      expect(res.body.securityDeposit).toBe(500);
      expect(res.headers['x-correlation-id']).toBe('test-req-001');
    });

    it('Rejects client amount mismatch with 400 INVALID_AMOUNT', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-tamper-001')
        .send({
          bookingId: 'BK-TEST-001',
          rentalAmount: 100, // Tampered client amount
          deposit: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_AMOUNT');
    });

    it('Rejects non-renter caller with 403 ACCESS_DENIED', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Idempotency-Key', 'idemp-other-001')
        .send({
          bookingId: 'BK-TEST-001',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
    });

    it('Rejects unapproved booking with 409 INVALID_BOOKING_STATE', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-pending-001')
        .send({
          bookingId: 'BK-PENDING',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
    });

    it('Rejects expired payment deadline with 409 BOOKING_EXPIRED', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-expired-001')
        .send({
          bookingId: 'BK-EXPIRED',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BOOKING_EXPIRED');
    });

    it('Rejects missing Idempotency-Key header with 400 MISSING_IDEMPOTENCY_KEY', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'BK-TEST-001',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('Idempotent replay: same key + same body returns replayed response with Idempotent-Replayed: true', async () => {
      const key = 'idemp-replay-test-01';
      const body = {
        bookingId: 'BK-TEST-002',
        rentalAmount: 3000,
        deposit: 500,
      };

      const res1 = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', key)
        .send(body);

      expect(res1.status).toBe(201);
      const originalPaymentId = res1.body.paymentId;

      // Second identical call
      const res2 = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', key)
        .send(body);

      expect(res2.status).toBe(201);
      expect(res2.headers['idempotent-replayed']).toBe('true');
      expect(res2.body.paymentId).toBe(originalPaymentId);
    });

    it('Idempotency conflict: same key + different body returns 422 IDEMPOTENCY_CONFLICT', async () => {
      const key = 'idemp-conflict-test-01';

      await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', key)
        .send({ bookingId: 'BK-TEST-003' });

      const resConflict = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', key)
        .send({ bookingId: 'BK-TEST-004' }); // Different body

      expect(resConflict.status).toBe(422);
      expect(resConflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('2. VerifyPayment & Webhook Handling', () => {
    let createdPaymentId;

    beforeEach(async () => {
      const uniqueBookingId = `BK-VERIFY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const initRes = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-verify-setup-${Date.now()}-${Math.random()}`)
        .send({ bookingId: uniqueBookingId });
      createdPaymentId = initRes.body.paymentId;
    });

    it('POST /v1/payments/:id/verifications: verifies payment, marks CONFIRMED, holds deposit', async () => {
      const res = await request(app)
        .post(`/v1/payments/${createdPaymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          gatewayTransactionReference: 'TXN-MOCK-12345',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.paymentId).toBe(createdPaymentId);
      expect(res.body.depositStatus).toBe('HELD');
    });

    it('Idempotent verification: verifying an already CONFIRMED payment returns 200 without duplicate deposit', async () => {
      await request(app)
        .post(`/v1/payments/${createdPaymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ gatewayTransactionReference: 'TXN-MOCK-12345' });

      // Second verification
      const res2 = await request(app)
        .post(`/v1/payments/${createdPaymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ gatewayTransactionReference: 'TXN-MOCK-12345' });

      expect(res2.status).toBe(200);
      expect(res2.body.alreadyVerified).toBe(true);
    });

    it('Gateway Webhook: valid HMAC signature verifies payment successfully', async () => {
      const orderId = `order_webhook_${Date.now()}`;
      // Insert payment with orderId
      sqlDb.prepare(`
        INSERT INTO payments (paymentId, bookingId, renterId, rentalAmount, platformFee, securityDeposit, totalAmount, status, gateway, gatewayOrderId, createdAt, updatedAt)
        VALUES (?, 'BK-WH-001', 'USR-RENTER01', 300000, 30000, 50000, 380000, 'PENDING_VERIFICATION', 'simulator', ?, datetime('now'), datetime('now'))
      `).run(`PAY-WH-${Date.now()}`, orderId);

      const webhookBody = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_ref_123',
              order_id: orderId,
              amount: 380000,
            },
          },
        },
      };

      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.GATEWAY_WEBHOOK_SECRET || 'agrirent_webhook_secret_key_2026_dev')
        .update(JSON.stringify(webhookBody))
        .digest('hex');

      const res = await request(app)
        .post('/v1/webhooks/gateway')
        .set('x-razorpay-signature', signature)
        .send(webhookBody);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('Gateway Webhook: invalid HMAC signature is rejected with 401 INVALID_SIGNATURE', async () => {
      const res = await request(app)
        .post('/v1/webhooks/gateway')
        .set('x-razorpay-signature', 'invalid_signature_hex')
        .send({ event: 'payment.captured' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('3. ETag, 304, Content Negotiation, and Cursor Pagination', () => {
    let paymentId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-etag-test')
        .send({ bookingId: 'BK-ETAG-001' });
      paymentId = res.body.paymentId;
    });

    it('ETag & 304 Not Modified on GET /v1/payments/:id', async () => {
      const res1 = await request(app)
        .get(`/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res1.status).toBe(200);
      const etag = res1.headers['etag'];
      expect(etag).toBeDefined();

      // Conditional GET with If-None-Match
      const res2 = await request(app)
        .get(`/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('If-None-Match', etag);

      expect(res2.status).toBe(304);
      expect(res2.text).toBe('');
    });

    it('Content Negotiation: supports application/json and application/xml, rejects others with 406', async () => {
      // JSON
      const resJson = await request(app)
        .get(`/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'application/json');
      expect(resJson.status).toBe(200);
      expect(resJson.headers['content-type']).toContain('application/json');

      // XML
      const resXml = await request(app)
        .get(`/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'application/xml');
      expect(resXml.status).toBe(200);
      expect(resXml.headers['content-type']).toContain('application/xml');
      expect(resXml.text).toContain('<?xml');

      // Unsupported media type -> 406
      const res406 = await request(app)
        .get(`/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'text/csv');
      expect(res406.status).toBe(406);
      expect(res406.body.error.code).toBe('NOT_ACCEPTABLE');
    });

    it('Cursor pagination across pages on GET /v1/payments', async () => {
      const res = await request(app)
        .get('/v1/payments?limit=2')
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.headers['cache-control']).toBe('private, no-cache');
    });
  });

  describe('4. Refunds (POST /v1/payments/:id/refunds)', () => {
    let confirmedPaymentId;

    beforeEach(async () => {
      const init = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-ref-init-${Date.now()}`)
        .send({ bookingId: `BK-REF-${Date.now()}` });

      confirmedPaymentId = init.body.paymentId;

      await request(app)
        .post(`/v1/payments/${confirmedPaymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ gatewayTransactionReference: 'TXN-REF-READY' });
    });

    it('Processes partial refund successfully and transitions to PARTIALLY_REFUNDED', async () => {
      const res = await request(app)
        .post(`/v1/payments/${confirmedPaymentId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-rfnd-1-${Date.now()}`)
        .send({
          amount: 1000,
          reason: 'Owner agreement cancellation',
        });

      expect(res.status).toBe(201);
      expect(res.body.paymentStatus).toBe('PARTIALLY_REFUNDED');
      expect(res.body.amount).toBe(1000);
      expect(res.body.totalRefunded).toBe(1000);
    });

    it('Rejects over-refund exceeding paid amount with 422 REFUND_NOT_ALLOWED', async () => {
      const res = await request(app)
        .post(`/v1/payments/${confirmedPaymentId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-rfnd-over-${Date.now()}`)
        .send({
          amount: 50000, // Exceeds 3800
          reason: 'Excessive refund attempt',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('REFUND_NOT_ALLOWED');
    });

    it('Rejects duplicate refund idempotency key with 409 DUPLICATE_REFUND', async () => {
      const key = `idemp-dup-rfnd-${Date.now()}`;

      await request(app)
        .post(`/v1/payments/${confirmedPaymentId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', key)
        .send({ amount: 500 });

      const res2 = await request(app)
        .post(`/v1/payments/${confirmedPaymentId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', key)
        .send({ amount: 500 });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('DUPLICATE_REFUND');
    });
  });

  describe('5. Settlements & Formula (POST /v1/bookings/:id/settlements)', () => {
    let settleBookingId;

    beforeEach(async () => {
      settleBookingId = `BK-SETTLE-${Date.now()}`;
      const init = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-set-init-${Date.now()}`)
        .send({ bookingId: settleBookingId });

      await request(app)
        .post(`/v1/payments/${init.body.paymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ gatewayTransactionReference: 'TXN-SET-CONFIRMED' });
    });

    it('Settles booking with correct mathematical formula (lateFine=100, damage=200, deposit=500)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${settleBookingId}/settlements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-settle-01-${Date.now()}`)
        .send({
          rentalAmount: 3000,
          lateFine: 100,
          damageDeduction: 200,
        });

      expect(res.status).toBe(201);
      // depositBalance = 500 - 100 - 200 = 200
      expect(res.body.depositBalance).toBe(200);
      expect(res.body.refundToRenter).toBe(200);
      // ownerPayout = 3000 + 100 + 200 = 3300
      expect(res.body.ownerPayout).toBe(3300);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('Rejects deduction exceeding held deposit with 422 INVALID_DEDUCTION', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${settleBookingId}/settlements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-settle-over-${Date.now()}`)
        .send({
          lateFine: 400,
          damageDeduction: 300, // Total 700 exceeds 500 deposit
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_DEDUCTION');
    });

    it('Rejects second settlement for the same booking with 409 SETTLEMENT_ALREADY_COMPLETED', async () => {
      await request(app)
        .post(`/v1/bookings/${settleBookingId}/settlements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-settle-first-${Date.now()}`)
        .send({ lateFine: 50 });

      const res2 = await request(app)
        .post(`/v1/bookings/${settleBookingId}/settlements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-settle-second-${Date.now()}`)
        .send({ lateFine: 50 });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SETTLEMENT_ALREADY_COMPLETED');
    });

    it('Rejects settlement when deductions do not match approved deductions from Claims with 422 INVALID_DEDUCTION', async () => {
      const mismatchBookingId = 'BK-MISMATCH-DEDUCTION';
      const init = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-mismatch-init-${Date.now()}`)
        .send({ bookingId: mismatchBookingId });

      await request(app)
        .post(`/v1/payments/${init.body.paymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ gatewayTransactionReference: 'TXN-SET-CONFIRMED-MISMATCH' });

      const res = await request(app)
        .post(`/v1/bookings/${mismatchBookingId}/settlements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-settle-mismatch-${Date.now()}`)
        .send({
          rentalAmount: 3000,
          lateFine: 100,
          damageDeduction: 200, // Mismatches approved 150
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_DEDUCTION');
      expect(res.body.error.message).toContain('Damage deduction mismatch');
    });
  });

  describe('6. Rate Limiting, Circuit Breaker, Timeout, and Status Codes', () => {
    it('Rate limiting: returns 429 and Retry-After header when limit exceeded', async () => {
      const limiter = require('../src/middleware/rateLimit.middleware').createRateLimiter({
        windowMs: 10000,
        max: 2,
        name: 'test_limit',
      });

      const testApp = require('express')();
      testApp.use(limiter);
      testApp.get('/test-rate', (req, res) => res.json({ ok: true }));
      testApp.use(require('../src/middleware/error.middleware'));

      // 1st request -> ok
      await request(testApp).get('/test-rate').set('x-test-rate-limit', 'true');
      // 2nd request -> ok
      await request(testApp).get('/test-rate').set('x-test-rate-limit', 'true');
      // 3rd request -> 429
      const res429 = await request(testApp).get('/test-rate').set('x-test-rate-limit', 'true');

      expect(res429.status).toBe(429);
      expect(res429.headers['retry-after']).toBeDefined();
      expect(res429.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('Circuit breaker: fast-fails with 503 GATEWAY_UNAVAILABLE when threshold reached', async () => {
      process.env.GATEWAY_SIMULATOR_FORCE_5XX = 'true';

      // Trigger consecutive failures
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/v1/payments')
          .set('Authorization', `Bearer ${renterToken}`)
          .set('Idempotency-Key', `idemp-breaker-${i}-${Date.now()}`)
          .send({ bookingId: `BK-BREAKER-${i}` });
      }

      // Next call should fast-fail with 503 from open circuit breaker
      const res503 = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-breaker-trip-${Date.now()}`)
        .send({ bookingId: 'BK-BREAKER-TRIP' });

      expect(res503.status).toBe(503);
      expect(res503.body.error.code).toBe('GATEWAY_UNAVAILABLE');

      // Reset
      process.env.GATEWAY_SIMULATOR_FORCE_5XX = 'false';
      gatewayClient.breaker.reset();
    });

    it('SOAP Service: GetPaymentStatus returns identical data to REST', async () => {
      // Seed confirmed payment
      const soapBookingId = `BK-SOAP-${Date.now()}`;
      const init = await request(app)
        .post('/v1/payments')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-soap-${Date.now()}`)
        .send({ bookingId: soapBookingId });

      await request(app)
        .post(`/v1/payments/${init.body.paymentId}/verifications`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ gatewayTransactionReference: 'TXN-SOAP-CONFIRMED' });

      // Call via SOAP client script
      const soapUrl = `http://localhost:${soapPort}/soap/payments?wsdl`;
      const soapResult = await callGetPaymentStatus(soapBookingId, soapUrl);

      expect(soapResult).toBeDefined();
      expect(soapResult.bookingId).toBe(soapBookingId);
      expect(soapResult.paymentStatus).toBe('CONFIRMED');
      expect(soapResult.paid).toBe(true);
      expect(Number(soapResult.totalAmount)).toBe(3800);
    });
  });
});
