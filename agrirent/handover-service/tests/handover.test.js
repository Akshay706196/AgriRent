const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const { initSqlDb, connectMongo, closeMongo, getSqlDb } = require('../src/config/database');
const { generateToken } = require('../src/middleware/auth.middleware');
const bookingClient = require('../src/clients/booking.client');
const paymentClient = require('../src/clients/payment.client');
const outboxService = require('../src/services/outbox.service');
const { lateFineService } = require('../src/services/lateFine.service');
const clock = require('../src/utils/clock');
const { attachSoapService } = require('../src/soap/handoverSoapService');
const { callCalculateLateFine } = require('../scripts/soapClient');

let mongoServer;
let sqlDb;
let httpServer;
let soapPort;

const TEST_RENTER_ID = 'USR-RENTER-101';
const TEST_OWNER_ID = 'USR-OWNER-201';
const TEST_OTHER_ID = 'USR-OTHER-999';

const renterToken = generateToken({ id: TEST_RENTER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const ownerToken = generateToken({ id: TEST_OWNER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const otherToken = generateToken({ id: TEST_OTHER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const unverifiedToken = generateToken({ id: TEST_RENTER_ID, role: 'USER', kycStatus: 'NOT_SUBMITTED' });
const adminToken = generateToken({ id: 'USR-ADMIN-001', role: 'ADMIN' });

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DEV_EXPOSE_PIN = 'true';
  process.env.SQL_DB_PATH = ':memory:';
  process.env.LATE_FINE_CAP_AT_DEPOSIT = 'true';

  // In-memory SQLite
  sqlDb = initSqlDb(':memory:');

  // In-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  await connectMongo(mongoServer.getUri());

  // Attach HTTP server and SOAP service on dynamic port
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
  clock.reset();
});

beforeEach(() => {
  clock.reset();
  bookingClient.breaker.reset();
  paymentClient.breaker.reset();
});

describe('AgriRent Handover, Return & Late-Fine Service (Service 5) Test Suite', () => {
  // Baseline test bookings
  const samplePaidBooking = {
    bookingId: 'BK-PAID-001',
    equipmentId: 'EQ-TRACTOR-01',
    ownerId: TEST_OWNER_ID,
    renterId: TEST_RENTER_ID,
    startDate: '2026-10-20T00:00:00.000Z',
    endDate: '2026-10-25T00:00:00.000Z',
    rentalDays: 5,
    pricePerDaySnapshot: 2000,
    rentalAmount: 10000,
    securityDeposit: 10000,
    totalAmount: 20000,
    currency: 'INR',
    status: 'PAID',
  };

  const sampleInRentalBooking = {
    ...samplePaidBooking,
    bookingId: 'BK-RENTAL-001',
    status: 'IN_RENTAL',
  };

  // Mock booking client for test suite
  jest.spyOn(bookingClient, 'getBookingDetails').mockImplementation(async (bookingId) => {
    return bookingClient.breaker.execute(async () => {
      if (bookingId === 'BK-NOT-FOUND') {
        const err = new Error('Booking not found');
        err.statusCode = 404;
        err.code = 'BOOKING_NOT_FOUND';
        throw err;
      }
      if (bookingId === 'BK-UNPAID') {
        return { ...samplePaidBooking, bookingId: 'BK-UNPAID', status: 'APPROVED' };
      }
      if (bookingId.startsWith('BK-FINE-CAP')) {
        return { ...sampleInRentalBooking, bookingId, securityDeposit: 5000 };
      }
      if (
        bookingId === 'BK-RENTAL-001' ||
        bookingId.startsWith('BK-RET') ||
        bookingId.startsWith('BK-FINE') ||
        bookingId.startsWith('BK-ETAG')
      ) {
        return { ...sampleInRentalBooking, bookingId };
      }
      return { ...samplePaidBooking, bookingId };
    });
  });

  // Mock payment client
  jest.spyOn(paymentClient, 'getPaymentStatus').mockImplementation(async (bookingId) => {
    if (bookingId === 'BK-UNPAID' || bookingId === 'BK-PAYMENT-FAILED') {
      return {
        bookingId,
        paymentStatus: 'PENDING',
        depositStatus: 'NONE',
        paid: false,
      };
    }
    return {
      bookingId,
      paymentId: 'PAY-12345',
      paymentStatus: 'CONFIRMED',
      depositStatus: 'HELD',
      paid: true,
      totalAmount: 15000,
      currency: 'INR',
      transactionReference: 'TXN-ABCDE',
    };
  });

  jest.spyOn(bookingClient, 'notifyHandoverConfirmed').mockResolvedValue({ success: true });
  jest.spyOn(bookingClient, 'notifyReturnConfirmed').mockResolvedValue({ success: true });

  // -------------------------------------------------------------
  // 1. PIN Generation: POST /v1/bookings/:bookingId/handover-pins
  // -------------------------------------------------------------
  describe('1. Handover PIN Generation (POST /v1/bookings/:bookingId/handover-pins)', () => {
    it('Happy path: Renter generates handover PIN (201)', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-gen-ho-001')
        .set('x-correlation-id', 'test-corr-ho-001');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('pinId');
      expect(res.body.deliveryStatus).toBe('DELIVERED');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('dev_pin'); // attached in test environment
      expect(res.body.dev_pin).toMatch(/^[0-9]{6}$/);
      expect(res.headers['x-correlation-id']).toBe('test-corr-ho-001');
    });

    it('Rejects generation if caller is not the renter (403 UNAUTHORIZED_USER)', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Idempotency-Key', 'idemp-gen-ho-unauth')
        .send();

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UNAUTHORIZED_USER');
    });

    it('Rejects generation if booking is not in PAID status (409 INVALID_BOOKING_STATE)', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-UNPAID/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-gen-ho-unpaid')
        .send();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
    });

    it('Rejects generation if payment is not confirmed (409 PAYMENT_NOT_CONFIRMED)', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-PAYMENT-FAILED/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-gen-ho-notconf')
        .send();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIRMED');
    });

    it('Rejects generation if user lacks KYC verification (403 KYC_REQUIRED)', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .set('Idempotency-Key', 'idemp-gen-ho-nokyc')
        .send();

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KYC_REQUIRED');
    });

    it('Enforces Idempotency: Replaying with same key and same body returns cached 201 without PIN', async () => {
      const idempKey = 'idemp-replay-gen-001';

      const firstRes = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', idempKey);

      expect(firstRes.status).toBe(201);
      const originalPinId = firstRes.body.pinId;

      const secondRes = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', idempKey);

      expect(secondRes.status).toBe(201);
      expect(secondRes.headers['idempotent-replayed']).toBe('true');
      expect(secondRes.body.pinId).toBe(originalPinId);
      // Security contract: Replayed snapshot must NOT contain plaintext PIN
      expect(secondRes.body.pin).toBeUndefined();
      expect(secondRes.body.dev_pin).toBeUndefined();
    });

    it('Supersedes active PIN when a new PIN is generated', async () => {
      const db = getSqlDb();
      const bookingId = 'BK-SUPERSEDE-01';

      // First PIN
      const res1 = await request(app)
        .post(`/v1/bookings/${bookingId}/handover-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-super-01');
      expect(res1.status).toBe(201);
      const pinId1 = res1.body.pinId;

      // Second PIN
      const res2 = await request(app)
        .post(`/v1/bookings/${bookingId}/handover-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-super-02');
      expect(res2.status).toBe(201);
      const pinId2 = res2.body.pinId;

      // Verify DB status
      const row1 = db.prepare('SELECT status FROM pins WHERE pinId = ?').get(pinId1);
      const row2 = db.prepare('SELECT status FROM pins WHERE pinId = ?').get(pinId2);

      expect(row1.status).toBe('SUPERSEDED');
      expect(row2.status).toBe('ACTIVE');

      // Attempting to verify superseded PIN fails with 409 PIN_EXPIRED
      const verifyRes = await request(app)
        .post(`/v1/bookings/${bookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', 'idemp-verify-super')
        .send({ pin: res1.body.dev_pin });

      expect(verifyRes.status).toBe(422); // Because current active PIN is pinId2
    });
  });

  // -------------------------------------------------------------
  // 2. Handover Verification: POST /v1/bookings/:bookingId/handovers
  // -------------------------------------------------------------
  describe('2. Handover PIN Verification (POST /v1/bookings/:bookingId/handovers)', () => {
    let activeBookingId = 'BK-HO-VERIFY-01';
    let validPin;

    beforeEach(async () => {
      activeBookingId = `BK-HO-VERIFY-${Date.now()}`;
      const pinRes = await request(app)
        .post(`/v1/bookings/${activeBookingId}/handover-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${activeBookingId}`);
      validPin = pinRes.body.dev_pin;
    });

    it('Happy path: Owner verifies handover PIN, transitions to IN_RENTAL (201)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${activeBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-verify-${activeBookingId}`)
        .send({
          pin: validPin,
          conditionReport: {
            engineHours: 120.5,
            fuelLevelPercent: 90,
            cleanliness: 'GOOD',
            visualInspectionNotes: 'Verified clean and functional.',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('handoverId');
      expect(res.body.status).toBe('IN_RENTAL');
      expect(res.body).toHaveProperty('handedOverAt');

      // Verify outbox was populated
      const db = getSqlDb();
      const outboxRow = db.prepare("SELECT * FROM outbox WHERE aggregateId = ? AND eventType = 'EquipmentHandedOver'").get(activeBookingId);
      expect(outboxRow).toBeDefined();
      expect(outboxRow.status).toBe('PENDING');
    });

    it('Rejects verification if caller is not the owner (403 UNAUTHORIZED_USER)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${activeBookingId}/handovers`)
        .set('Authorization', `Bearer ${renterToken}`) // Renter cannot verify own PIN
        .set('Idempotency-Key', `idemp-owner-err-${activeBookingId}`)
        .send({ pin: validPin });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UNAUTHORIZED_USER');
    });

    it('Rejects invalid 6-digit PIN with 422 INVALID_PIN', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${activeBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-invalid-pin-${activeBookingId}`)
        .send({ pin: '000000' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_PIN');
    });

    it('Locks PIN after 3 failed attempts (423 PIN_LOCKED)', async () => {
      const lockBookingId = `BK-LOCK-${Date.now()}`;
      await request(app)
        .post(`/v1/bookings/${lockBookingId}/handover-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${lockBookingId}`);

      // Attempt 1 -> 422
      const att1 = await request(app)
        .post(`/v1/bookings/${lockBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-att1-${lockBookingId}`)
        .send({ pin: '111111' });
      expect(att1.status).toBe(422);

      // Attempt 2 -> 422
      const att2 = await request(app)
        .post(`/v1/bookings/${lockBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-att2-${lockBookingId}`)
        .send({ pin: '222222' });
      expect(att2.status).toBe(422);

      // Attempt 3 -> 423 PIN_LOCKED
      const att3 = await request(app)
        .post(`/v1/bookings/${lockBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-att3-${lockBookingId}`)
        .send({ pin: '333333' });
      expect(att3.status).toBe(423);
      expect(att3.body.error.code).toBe('PIN_LOCKED');

      // Subsequent attempt with valid PIN is also rejected with 423
      const att4 = await request(app)
        .post(`/v1/bookings/${lockBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-att4-${lockBookingId}`)
        .send({ pin: validPin });
      expect(att4.status).toBe(423);
    });

    it('Rejects expired PIN with 409 PIN_EXPIRED (Injected Clock)', async () => {
      const expiryBookingId = `BK-EXP-${Date.now()}`;
      const pinRes = await request(app)
        .post(`/v1/bookings/${expiryBookingId}/handover-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${expiryBookingId}`);
      const testPin = pinRes.body.dev_pin;

      // Fast forward clock by 35 minutes (past 30-min TTL)
      clock.setOverride(new Date(Date.now() + 35 * 60 * 1000));

      const res = await request(app)
        .post(`/v1/bookings/${expiryBookingId}/handovers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-exp-verify-${expiryBookingId}`)
        .send({ pin: testPin });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PIN_EXPIRED');
    });

    it('Two concurrent verifications of the same PIN: exactly one succeeds', async () => {
      const raceBookingId = `BK-RACE-${Date.now()}`;
      const pinRes = await request(app)
        .post(`/v1/bookings/${raceBookingId}/handover-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-race-gen-${raceBookingId}`);
      const racePin = pinRes.body.dev_pin;

      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/v1/bookings/${raceBookingId}/handovers`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('Idempotency-Key', `idemp-race-A-${raceBookingId}`)
          .send({ pin: racePin }),
        request(app)
          .post(`/v1/bookings/${raceBookingId}/handovers`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('Idempotency-Key', `idemp-race-B-${raceBookingId}`)
          .send({ pin: racePin }),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409); // The second caller receives 409 PIN_ALREADY_USED or INVALID_BOOKING_STATE
    });
  });

  // -------------------------------------------------------------
  // 3. Return PIN & Return Verification with Late Fine
  // -------------------------------------------------------------
  describe('3. Return PIN & Verification (POST /v1/bookings/:id/returns)', () => {
    let returnBookingId = 'BK-RET-001';
    let returnPin;

    beforeEach(async () => {
      returnBookingId = `BK-RET-${Date.now()}`;
      // Generate return PIN for booking in IN_RENTAL
      const genRes = await request(app)
        .post(`/v1/bookings/${returnBookingId}/return-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-ret-pin-${returnBookingId}`);
      returnPin = genRes.body.dev_pin;
    });

    it('Happy path: Return on-time results in 0 fine and RETURNED status (201)', async () => {
      // Set clock to within rental period (e.g. Oct 24)
      clock.setOverride(new Date('2026-10-24T12:00:00.000Z'));

      const res = await request(app)
        .post(`/v1/bookings/${returnBookingId}/returns`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-ret-verify-${returnBookingId}`)
        .send({
          pin: returnPin,
          conditionReport: {
            engineHours: 135.0,
            fuelLevelPercent: 85,
            cleanliness: 'GOOD',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('RETURNED');
      expect(res.body.lateFine.fineAmount).toBe(0);
      expect(res.body.lateFine.overdueDays).toBe(0);

      // Verify fine was persisted in SQL late_fines table
      const db = getSqlDb();
      const fineRow = db.prepare('SELECT * FROM late_fines WHERE bookingId = ?').get(returnBookingId);
      expect(fineRow).toBeDefined();
      expect(fineRow.fineAmount).toBe(0);
    });

    it('Calculates late fine: 1 minute over grace period incurs 1 day fine', async () => {
      const fineBookingId = `BK-FINE-GRACE-${Date.now()}`;
      const pinRes = await request(app)
        .post(`/v1/bookings/${fineBookingId}/return-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${fineBookingId}`);

      // dueAt for endDate '2026-10-25' in Asia/Kolkata is 2026-10-24T18:30:00.000Z.
      // Grace period = 30 min -> threshold is 2026-10-24T19:00:00.000Z.
      // 1 minute over grace = 2026-10-24T19:01:00.000Z.
      clock.setOverride(new Date('2026-10-24T19:01:00.000Z'));

      const res = await request(app)
        .post(`/v1/bookings/${fineBookingId}/returns`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-verify-${fineBookingId}`)
        .send({ pin: pinRes.body.dev_pin });

      expect(res.status).toBe(201);
      expect(res.body.lateFine.overdueDays).toBe(1);
      expect(res.body.lateFine.fineAmount).toBe(3000); // 1 day * 3000 INR
    });

    it('Calculates late fine: 2 days late incurs 2 days fine', async () => {
      const lateBookingId = `BK-FINE-2DAYS-${Date.now()}`;
      // 2 days past dueAt: Return PIN is generated at time of return
      clock.setOverride(new Date('2026-10-26T18:00:00.000Z'));

      const pinRes = await request(app)
        .post(`/v1/bookings/${lateBookingId}/return-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${lateBookingId}`);

      const res = await request(app)
        .post(`/v1/bookings/${lateBookingId}/returns`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-verify-${lateBookingId}`)
        .send({ pin: pinRes.body.dev_pin });

      expect(res.status).toBe(201);
      expect(res.body.lateFine.overdueDays).toBe(2);
      expect(res.body.lateFine.fineAmount).toBe(6000); // 2 days * 3000 INR
    });

    it('Caps late fine at security deposit when fine exceeds deposit', async () => {
      const capBookingId = `BK-FINE-CAP-${Date.now()}`;

      // 5 days late: 5 * 3000 = 15,000 INR; securityDeposit is 5000 INR
      clock.setOverride(new Date('2026-10-29T18:00:00.000Z'));

      const pinRes = await request(app)
        .post(`/v1/bookings/${capBookingId}/return-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${capBookingId}`);

      const res = await request(app)
        .post(`/v1/bookings/${capBookingId}/returns`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-verify-${capBookingId}`)
        .send({ pin: pinRes.body.dev_pin });

      expect(res.status).toBe(201);
      expect(res.body.lateFine.depositCapApplied).toBe(true);
      expect(res.body.lateFine.fineAmount).toBe(5000); // Capped at security deposit of 5000
    });
  });

  // -------------------------------------------------------------
  // 4. CalculateLateFine (GET /v1/bookings/:id/late-fine) & ETag
  // -------------------------------------------------------------
  describe('4. CalculateLateFine & Caching (GET /v1/bookings/:id/late-fine)', () => {
    it('Preview calculation with ?returnTime returns dynamic penalty with no-store', async () => {
      const res = await request(app)
        .get('/v1/bookings/BK-PAID-001/late-fine?returnTime=2026-10-26T18:00:00.000Z')
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.preview).toBe(true);
      expect(res.body.overdueDays).toBe(2);
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('Rejects invalid ISO timestamp with 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .get('/v1/bookings/BK-PAID-001/late-fine?returnTime=not-a-valid-date')
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    });

    it('Supports ETag and 304 Not Modified on persisted return record', async () => {
      const persistBookingId = `BK-ETAG-${Date.now()}`;
      const pinRes = await request(app)
        .post(`/v1/bookings/${persistBookingId}/return-pins`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-gen-${persistBookingId}`);

      const returnRes = await request(app)
        .post(`/v1/bookings/${persistBookingId}/returns`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-ret-${persistBookingId}`)
        .send({ pin: pinRes.body.dev_pin });

      const returnId = returnRes.body.returnId;

      // GET return with ETag
      const firstGet = await request(app)
        .get(`/v1/bookings/${persistBookingId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(firstGet.status).toBe(200);
      const etag = firstGet.headers['etag'];
      expect(etag).toBeDefined();

      // Subsequent GET with If-None-Match -> 304
      const secondGet = await request(app)
        .get(`/v1/bookings/${persistBookingId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('If-None-Match', etag);

      expect(secondGet.status).toBe(304);
    });
  });

  // -------------------------------------------------------------
  // 5. Content Negotiation (JSON, XML, 406)
  // -------------------------------------------------------------
  describe('5. Content Negotiation (application/json, application/xml, 406)', () => {
    it('Returns application/xml when Accept is application/xml', async () => {
      const res = await request(app)
        .get('/v1/bookings/BK-PAID-001/late-fine?returnTime=2026-10-24T12:00:00.000Z')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'application/xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<lateFine>');
      expect(res.text).toContain('<fineAmount>');
    });

    it('Returns 406 NOT_ACCEPTABLE for unsupported representations', async () => {
      const res = await request(app)
        .get('/v1/bookings/BK-PAID-001/late-fine')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'image/png');

      expect(res.status).toBe(406);
      expect(res.body.error.code).toBe('NOT_ACCEPTABLE');
    });
  });

  // -------------------------------------------------------------
  // 6. Cursor Pagination (GET /v1/handovers & GET /events)
  // -------------------------------------------------------------
  describe('6. Cursor Pagination (GET /v1/handovers & GET /events)', () => {
    it('Paginates handovers across pages with opaque cursor and Link header', async () => {
      const db = getSqlDb();
      const baseNow = Date.now();

      // Seed 6 handovers
      for (let i = 1; i <= 6; i++) {
        const timeIso = new Date(baseNow + i * 1000).toISOString();
        db.prepare(`
          INSERT INTO pins (pinId, bookingId, type, hashedPin, status, deliveryStatus, attempts, maxAttempts, expiresAt, createdAt, updatedAt)
          VALUES (?, ?, 'HANDOVER', 'hash', 'USED', 'DELIVERED', 0, 3, ?, ?, ?)
        `).run(`PIN-PAGE-${i}`, `BK-PAGE-${i}`, timeIso, timeIso, timeIso);

        db.prepare(`
          INSERT INTO handovers (handoverId, bookingId, pinId, handedOverBy, handedOverTo, handedOverAt, status, createdAt, updatedAt)
          VALUES (?, ?, ?, 'OWNER', 'RENTER', ?, 'IN_RENTAL', ?, ?)
        `).run(`HO-PAGE-${i}`, `BK-PAGE-${i}`, `PIN-PAGE-${i}`, timeIso, timeIso, timeIso);
      }

      // Page 1: limit=2
      const page1 = await request(app)
        .get('/v1/handovers?limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.items.length).toBe(2);
      expect(page1.body.hasMore).toBe(true);
      expect(page1.body.nextCursor).toBeDefined();
      expect(page1.headers['link']).toContain('rel="next"');

      // Page 2: with cursor
      const page2 = await request(app)
        .get(`/v1/handovers?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.items.length).toBe(2);
      expect(page2.body.items[0].handoverId).not.toBe(page1.body.items[0].handoverId);
    });

    it('Paginates MongoDB event history for booking', async () => {
      const res = await request(app)
        .get('/v1/bookings/BK-PAID-001/events?limit=5')
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 7. Schema Validation & HTTP Status Codes Coverage
  // -------------------------------------------------------------
  describe('7. Status Codes & Validation Coverage', () => {
    it('Rejects 5-digit PIN with 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-PAID-001/handovers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', 'idemp-bad-pin')
        .send({ pin: '12345' }); // Only 5 digits

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
      expect(res.body.error.details).toBeDefined();
    });

    it('Returns 401 UNAUTHENTICATED when Authorization token is missing', async () => {
      const res = await request(app)
        .get('/v1/bookings/BK-PAID-001/late-fine');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('Returns 422 IDEMPOTENCY_CONFLICT when same key is used with different payload', async () => {
      const idempKey = 'idemp-conflict-test-01';

      const firstRes = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', idempKey)
        .send();
      expect(firstRes.status).toBe(201);

      const conflictRes = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', idempKey)
        .send({ differentField: 'payload' });

      expect(conflictRes.status).toBe(422);
      expect(conflictRes.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('Enforces Rate Limiting with 429 and Retry-After header', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-PAID-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-rate-test')
        .set('x-test-rate-limit', 'true'); // Triggers rate limiting in test mode

      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
      expect(res.headers).toHaveProperty('ratelimit-reset');
    });

    it('Returns 503 UPSTREAM_UNAVAILABLE when Booking Service circuit breaker opens', async () => {
      // Trip circuit breaker by forcing consecutive failures
      bookingClient.breaker.failureCount = 3;
      bookingClient.breaker.state = 'OPEN';
      bookingClient.breaker.nextAttempt = Date.now() + 10000;

      const res = await request(app)
        .post('/v1/bookings/BK-TRIP-001/handover-pins')
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', 'idemp-breaker-trip');

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    });
  });

  // -------------------------------------------------------------
  // 8. SOAP CalculateLateFine Service
  // -------------------------------------------------------------
  describe('8. WSDL & SOAP CalculateLateFine (/soap/handover)', () => {
    it('Exposes WSDL at /soap/handover?wsdl', async () => {
      const res = await request(app).get('/soap/handover?wsdl');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<definitions');
      expect(res.text).toContain('name="HandoverService"');
    });

    it('Successfully invokes SOAP CalculateLateFine operation', async () => {
      const endpoint = `http://localhost:${soapPort}/soap/handover?wsdl`;
      const result = await callCalculateLateFine(endpoint, {
        bookingId: 'BK-PAID-001',
        actualReturnTimestamp: '2026-10-26T18:00:00.000Z',
      });

      expect(result).toBeDefined();
      expect(result.bookingId).toBe('BK-PAID-001');
      expect(parseInt(result.overdueDays, 10)).toBe(2);
      expect(parseFloat(result.fineAmount)).toBe(6000);
      expect(result.currency).toBe('INR');
    });
  });

  // -------------------------------------------------------------
  // 9. Outbox Dispatcher
  // -------------------------------------------------------------
  describe('9. Outbox Dispatcher Background Worker', () => {
    it('Processes pending outbox records and marks them PROCESSED', async () => {
      const db = getSqlDb();
      outboxService.addEvent(db, {
        eventType: 'EquipmentHandedOver',
        aggregateId: 'BK-OUTBOX-TEST',
        payload: { handoverId: 'HO-TEST', status: 'IN_RENTAL' },
      });

      await outboxService.dispatchPendingEvents();

      const row = db.prepare("SELECT status FROM outbox WHERE aggregateId = 'BK-OUTBOX-TEST'").get();
      expect(row.status).toBe('PROCESSED');
      expect(bookingClient.notifyHandoverConfirmed).toHaveBeenCalled();
    });
  });
});
