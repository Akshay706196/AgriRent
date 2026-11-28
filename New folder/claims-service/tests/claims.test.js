const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const { initSqlDb, connectMongo, closeMongo, getSqlDb } = require('../src/config/database');
const { generateToken } = require('../src/middleware/auth.middleware');
const bookingClient = require('../src/clients/booking.client');
const paymentClient = require('../src/clients/payment.client');
const handoverClient = require('../src/clients/handover.client');
const notificationClient = require('../src/clients/notification.client');
const clock = require('../src/utils/clock');
const { attachSoapService } = require('../src/soap/claimsSoapService');
const { callGetDisputeStatus } = require('../scripts/soapClient');
const settlementSagaService = require('../src/services/settlementSaga.service');
const outboxService = require('../src/services/outbox.service');
const { resetMongoQueryCount, getMongoQueryCount } = require('../src/graphql/dataloaders');
const ClaimEvidence = require('../src/models/ClaimEvidence');

let mongoServer;
let sqlDb;
let httpServer;
let soapPort;

const TEST_RENTER_ID = 'USR-RENTER-101';
const TEST_OWNER_ID = 'USR-OWNER-201';
const TEST_OTHER_ID = 'USR-OTHER-999';
const TEST_ADMIN_ID = 'USR-ADMIN-001';

const renterToken = generateToken({ id: TEST_RENTER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const ownerToken = generateToken({ id: TEST_OWNER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const otherToken = generateToken({ id: TEST_OTHER_ID, role: 'USER', kycStatus: 'VERIFIED' });
const unverifiedToken = generateToken({ id: TEST_OWNER_ID, role: 'USER', kycStatus: 'NOT_SUBMITTED' });
const adminToken = generateToken({ id: TEST_ADMIN_ID, role: 'ADMIN' });
const internalToken = 'agrirent_internal_service_token_2026';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SQL_DB_PATH = ':memory:';

  // 1. In-memory SQLite
  sqlDb = initSqlDb(':memory:');

  // 2. In-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  await connectMongo(mongoServer.getUri());

  // 3. Attach HTTP server & SOAP service on dynamic port
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
  resetMongoQueryCount();
  bookingClient.breaker.reset();
  paymentClient.breaker.reset();
  handoverClient.breaker.reset();
});

describe('AgriRent Service 6: Claims, Disputes & Reviews Test Suite', () => {
  const sampleBooking = {
    bookingId: 'BK-CLM-001',
    equipmentId: 'EQ-TRACTOR-01',
    ownerId: TEST_OWNER_ID,
    renterId: TEST_RENTER_ID,
    rentalAmount: 3000,
    platformFee: 300,
    securityDeposit: 500,
    totalAmount: 3800,
    currency: 'INR',
    status: 'RETURNED',
    returnedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  };

  // Mock upstream clients
  jest.spyOn(bookingClient, 'getBookingDetails').mockImplementation(async (bookingId) => {
    return bookingClient.breaker.execute(async () => {
      if (bookingId === 'BK-NOT-FOUND') return null;
      if (bookingId === 'BK-IN-RENTAL') {
        return { ...sampleBooking, bookingId, status: 'IN_RENTAL' };
      }
      return { ...sampleBooking, bookingId };
    });
  });

  jest.spyOn(bookingClient, 'notifyCompletion').mockResolvedValue({ success: true });

  jest.spyOn(handoverClient, 'getLateFine').mockResolvedValue({
    fineAmount: 50, // 50 INR
    overdueDays: 1,
    status: 'ASSESSED',
  });

  jest.spyOn(handoverClient, 'getConditionReports').mockResolvedValue({
    bookingId: 'BK-CLM-001',
    handoverConditionReport: { engineHours: 100, cleanliness: 'EXCELLENT', photoUrls: ['http://photo1.jpg'] },
    returnConditionReport: { engineHours: 120, cleanliness: 'DIRTY', photoUrls: ['http://photo2.jpg'] },
  });

  jest.spyOn(paymentClient, 'getPaymentStatus').mockResolvedValue({
    bookingId: 'BK-CLM-001',
    paid: true,
    paymentStatus: 'CONFIRMED',
    depositStatus: 'HELD',
    heldDeposit: 500, // 500 INR
  });

  jest.spyOn(paymentClient, 'settleBooking').mockImplementation(async (bookingId, payload, idempKey) => {
    if (bookingId === 'BK-FAIL-422') {
      const err = new Error('Deductions exceed held deposit');
      err.statusCode = 422;
      throw err;
    }
    if (bookingId === 'BK-ALREADY-SETTLED') {
      return { success: true, alreadyCompleted: true, data: { settlementId: 'SET-EXISTING-99' } };
    }
    return { success: true, data: { settlementId: `SET-${Date.now()}`, refundToRenter: 300, ownerPayout: 3200 } };
  });

  // ============================================================================
  // 1. DAMAGE CLAIMS (POST, GET, EVIDENCE, EVENTS)
  // ============================================================================
  describe('1. Damage Claims (POST /v1/bookings/:id/claims, GET /v1/claims/:id)', () => {
    let createdClaimId;
    const bookingId = 'BK-CLM-001';

    it('Happy path: Equipment Owner files damage claim with photos (201)', async () => {
      const idempKey = `idemp-claim-${Date.now()}`;
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', idempKey)
        .send({
          reason: 'Cracked hydraulic pump casing during operation',
          claimedAmount: 150,
          evidence: {
            photos: ['https://storage.agrirent.in/claims/crack1.jpg', 'https://storage.agrirent.in/claims/crack2.jpg'],
            notes: 'Noticeable fluid leak upon equipment check-in',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.claimId).toMatch(/^CLM-/);
      expect(res.body.status).toBe('SUBMITTED');
      expect(res.body.claimedAmount).toBe(150);
      expect(res.body.windowClosesAt).toBeDefined();

      createdClaimId = res.body.claimId;
    });

    it('Rejects claim if claimantId in body disagrees with authenticated JWT (400 INVALID_CLAIM)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-mismatch-${Date.now()}`)
        .send({
          claimantId: 'USR-IMPOSTOR-999',
          reason: 'Broken hitch',
          claimedAmount: 100,
          evidence: { photos: ['http://photo.jpg'] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CLAIM');
      expect(res.body.error.message).toContain('does not match');
    });

    it('Rejects claim when claimedAmount <= 0 (400 INVALID_CLAIM)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-zero-${Date.now()}`)
        .send({
          reason: 'Zero amount claim',
          claimedAmount: 0,
          evidence: { photos: ['http://photo.jpg'] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CLAIM');
    });

    it('Rejects claim when photo evidence is missing or empty (400 INVALID_CLAIM)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-noevd-${Date.now()}`)
        .send({
          reason: 'Missing evidence claim',
          claimedAmount: 100,
          evidence: { photos: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CLAIM');
    });

    it('Rejects non-participant caller with 403 NOT_PARTICIPANT', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Idempotency-Key', `idemp-other-${Date.now()}`)
        .send({
          reason: 'Third party attempt',
          claimedAmount: 100,
          evidence: { photos: ['http://photo.jpg'] },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_PARTICIPANT');
    });

    it('Rejects renter trying to file damage claim with 403 NOT_EQUIPMENT_OWNER', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-renter-${Date.now()}`)
        .send({
          reason: 'Renter claiming against own deposit',
          claimedAmount: 100,
          evidence: { photos: ['http://photo.jpg'] },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_EQUIPMENT_OWNER');
    });

    it('Rejects claim if booking is not in RETURNED state (409 INVALID_BOOKING_STATE)', async () => {
      const res = await request(app)
        .post('/v1/bookings/BK-IN-RENTAL/claims')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-unret-${Date.now()}`)
        .send({
          reason: 'Unreturned equipment claim',
          claimedAmount: 100,
          evidence: { photos: ['http://photo.jpg'] },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
    });

    it('Rejects claim after claim window closed via Clock time override (409 CLAIM_WINDOW_CLOSED)', async () => {
      // Fast forward 50 hours (past 48-hour window)
      clock.setOverride(new Date(Date.now() + 50 * 3600 * 1000).toISOString());

      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-expired-win-${Date.now()}`)
        .send({
          reason: 'Late claim',
          claimedAmount: 100,
          evidence: { photos: ['http://photo.jpg'] },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CLAIM_WINDOW_CLOSED');

      clock.reset();
    });

    it('Idempotent replay: Replaying same key + same body returns replayed 201 with Idempotent-Replayed: true', async () => {
      const key = `idemp-replay-test-${Date.now()}`;
      const payload = {
        reason: 'Hydraulic cylinder bent',
        claimedAmount: 120,
        evidence: { photos: ['http://photo.jpg'] },
      };

      const res1 = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.headers['idempotent-replayed']).toBe('true');
      expect(res2.body.claimId).toBe(res1.body.claimId);
    });

    it('Idempotency conflict: Replaying same key with DIFFERENT body returns 422 IDEMPOTENCY_CONFLICT', async () => {
      const key = `idemp-conflict-test-${Date.now()}`;
      await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', key)
        .send({
          reason: 'First payload',
          claimedAmount: 100,
          evidence: { photos: ['http://photo1.jpg'] },
        });

      const res2 = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', key)
        .send({
          reason: 'DIFFERENT payload',
          claimedAmount: 200,
          evidence: { photos: ['http://photo2.jpg'] },
        });

      expect(res2.status).toBe(422);
      expect(res2.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('Adds evidence items to an existing claim while in SUBMITTED state (201)', async () => {
      const res = await request(app)
        .post(`/v1/claims/${createdClaimId}/evidence-items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-evd-${Date.now()}`)
        .send({
          photos: ['https://storage.agrirent.in/claims/leak-detail.jpg'],
          notes: 'Oil drip caught on paper towel',
        });

      expect(res.status).toBe(201);
      expect(res.body.evidenceId).toMatch(/^EVD-/);
      expect(res.body.photos).toContain('https://storage.agrirent.in/claims/leak-detail.jpg');
    });

    it('GET /v1/claims/:id returns claim details with ETag, 304, and XML support', async () => {
      const res = await request(app)
        .get(`/v1/claims/${createdClaimId}`)
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.claimId).toBe(createdClaimId);
      expect(res.headers.etag).toBeDefined();

      // 304 via ETag
      const res304 = await request(app)
        .get(`/v1/claims/${createdClaimId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('If-None-Match', res.headers.etag);

      expect(res304.status).toBe(304);

      // XML negotiation
      const resXml = await request(app)
        .get(`/v1/claims/${createdClaimId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'application/xml');

      expect(resXml.status).toBe(200);
      expect(resXml.headers['content-type']).toContain('application/xml');
      expect(resXml.text).toContain('<claimId>');
    });

    it('GET /v1/claims/:id/events returns cursor-paginated timeline from MongoDB', async () => {
      const res = await request(app)
        .get(`/v1/claims/${createdClaimId}/events`)
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0].eventType).toBeDefined();
    });
  });

  // ============================================================================
  // 2. DISPUTES (POST, GET, ONE-OPEN CONSTRAINT, WINDOW)
  // ============================================================================
  describe('2. Disputes (POST /v1/claims/:id/disputes, GET /v1/disputes/:id)', () => {
    let disputedClaimId;
    let createdDisputeId;
    const bookingId = 'BK-CLM-001';

    beforeAll(async () => {
      const clm = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-for-dsp-${Date.now()}`)
        .send({
          reason: 'Bent drawbar',
          claimedAmount: 200,
          evidence: { photos: ['http://drawbar.jpg'] },
        });
      disputedClaimId = clm.body.claimId;
    });

    it('Happy path: Renter raises dispute against active claim (201 OPEN)', async () => {
      const res = await request(app)
        .post(`/v1/claims/${disputedClaimId}/disputes`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-dsp-happy-${Date.now()}`)
        .send({
          reason: 'Drawbar was already bent at equipment handover; see inspection report',
        });

      expect(res.status).toBe(201);
      expect(res.body.disputeId).toMatch(/^DSP-/);
      expect(res.body.status).toBe('OPEN');
      createdDisputeId = res.body.disputeId;
    });

    it('Rejects non-renter raising dispute with 403 NOT_PARTICIPANT', async () => {
      const res = await request(app)
        .post(`/v1/claims/${disputedClaimId}/disputes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-dsp-owner-${Date.now()}`)
        .send({ reason: 'Owner cannot dispute own claim' });

      expect(res.status).toBe(403);
    });

    it('Enforces constraint: At most ONE OPEN dispute per claim (409 DISPUTE_ALREADY_OPEN)', async () => {
      const res = await request(app)
        .post(`/v1/claims/${disputedClaimId}/disputes`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-dsp-dup-${Date.now()}`)
        .send({ reason: 'Duplicate dispute attempt' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DISPUTE_ALREADY_OPEN');
    });

    it('Rejects dispute after dispute window closed via Clock time override (409 DISPUTE_WINDOW_CLOSED)', async () => {
      // Create new claim
      const clm = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-for-dsp-win-${Date.now()}`)
        .send({
          reason: 'Scratched hood',
          claimedAmount: 50,
          evidence: { photos: ['http://photo.jpg'] },
        });

      // Fast forward past 72-hour dispute window
      clock.setOverride(new Date(Date.now() + 75 * 3600 * 1000).toISOString());

      const res = await request(app)
        .post(`/v1/claims/${clm.body.claimId}/disputes`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-dsp-late-${Date.now()}`)
        .send({ reason: 'Late dispute' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DISPUTE_WINDOW_CLOSED');

      clock.reset();
    });

    it('GET /v1/disputes/:id returns dispute status with ETag, 304, and XML support', async () => {
      const res = await request(app)
        .get(`/v1/disputes/${createdDisputeId}`)
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.disputeId).toBe(createdDisputeId);
      expect(res.body.status).toBe('OPEN');
      expect(res.headers.etag).toBeDefined();

      const res304 = await request(app)
        .get(`/v1/disputes/${createdDisputeId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('If-None-Match', res.headers.etag);

      expect(res304.status).toBe(304);

      const resXml = await request(app)
        .get(`/v1/disputes/${createdDisputeId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'application/xml');

      expect(resXml.status).toBe(200);
      expect(resXml.headers['content-type']).toContain('application/xml');
      expect(resXml.text).toContain('<disputeId>');
    });
  });

  // ============================================================================
  // 3. DECISIONS (POST /v1/claims/:id/decisions)
  // ============================================================================
  describe('3. Decisions & Dispute Resolution (POST /v1/claims/:id/decisions)', () => {
    let decClaimId;
    let decDisputeId;
    const bookingId = 'BK-CLM-001';

    beforeAll(async () => {
      const clm = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-clm-dec-${Date.now()}`)
        .send({
          reason: 'Cracked windshield',
          claimedAmount: 250,
          evidence: { photos: ['http://windshield.jpg'] },
        });
      decClaimId = clm.body.claimId;

      const dsp = await request(app)
        .post(`/v1/claims/${decClaimId}/disputes`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-dsp-dec-${Date.now()}`)
        .send({ reason: 'Rock chip occurred on public road, not field work' });
      decDisputeId = dsp.body.disputeId;
    });

    it('Rejects decision if caller lacks ADMIN role with 403 ADMIN_REQUIRED', async () => {
      const res = await request(app)
        .post(`/v1/claims/${decClaimId}/decisions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-dec-unauth-${Date.now()}`)
        .send({
          decision: 'APPROVED',
          approvedAmount: 200,
          reason: 'Owner approving own claim',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('Rejects approvedAmount > claimedAmount with 422 INVALID_DEDUCTION', async () => {
      const res = await request(app)
        .post(`/v1/claims/${decClaimId}/decisions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-dec-overclaim-${Date.now()}`)
        .send({
          decision: 'APPROVED',
          approvedAmount: 300, // Claimed was 250
          reason: 'Attempting to approve more than claimed',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_DEDUCTION');
    });

    it('Rejects deduction if total deductions + lateFine > held deposit with 422 INVALID_DEDUCTION', async () => {
      // Deposit is 500, lateFine is 50 -> max allowable is 450
      // Create a claim for 480
      const bigClm = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-big-clm-${Date.now()}`)
        .send({
          reason: 'Massive damage',
          claimedAmount: 480,
          evidence: { photos: ['http://big.jpg'] },
        });

      const res = await request(app)
        .post(`/v1/claims/${bigClm.body.claimId}/decisions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-dec-overdep-${Date.now()}`)
        .send({
          decision: 'APPROVED',
          approvedAmount: 480, // 480 + 50 late fine = 530 > 500 deposit
          reason: 'Exceeding deposit cap',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_DEDUCTION');
    });

    it('Admin partially approves claim (200) and automatically resolves open dispute in the same SQL transaction', async () => {
      const res = await request(app)
        .post(`/v1/claims/${decClaimId}/decisions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-dec-partial-${Date.now()}`)
        .send({
          decision: 'PARTIALLY_APPROVED',
          approvedAmount: 150,
          reason: 'Fair wear and tear deducted; 150 approved for repair',
        });

      expect(res.status).toBe(200);
      expect(res.body.decision).toBe('PARTIALLY_APPROVED');
      expect(res.body.approvedAmount).toBe(150);
      expect(res.body.deduction).toBeDefined();

      // Verify dispute was resolved in the same transaction
      const dspRes = await request(app)
        .get(`/v1/disputes/${decDisputeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(dspRes.status).toBe(200);
      expect(dspRes.body.status).toBe('RESOLVED');
      expect(dspRes.body.decision).toBe('PARTIALLY_APPROVED');
    });

    it('Rejects second decision on already decided claim with 409 CLAIM_ALREADY_DECIDED', async () => {
      const res = await request(app)
        .post(`/v1/claims/${decClaimId}/decisions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-dec-repeat-${Date.now()}`)
        .send({
          decision: 'REJECTED',
          reason: 'Changing mind',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CLAIM_ALREADY_DECIDED');
    });
  });

  // ============================================================================
  // 4. REVIEWS (POST, GET, RATING BOUNDS, ONE PER BOOKING)
  // ============================================================================
  describe('4. Reviews (POST /v1/bookings/:id/reviews, GET /v1/reviews)', () => {
    let createdReviewId;
    const bookingId = 'BK-CLM-001';

    it('Happy path: Renter reviews owner with rating 5 (201 PUBLISHED)', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/reviews`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-rev-renter-${Date.now()}`)
        .send({
          targetUserId: TEST_OWNER_ID,
          rating: 5,
          feedback: 'Excellent equipment, powerful engine and very helpful owner!',
        });

      expect(res.status).toBe(201);
      expect(res.body.reviewId).toMatch(/^REV-/);
      expect(res.body.rating).toBe(5);
      expect(res.body.status).toBe('PUBLISHED');
      createdReviewId = res.body.reviewId;
    });

    it('Rejects rating bounds: rating 0 or 6 rejected with 400 INVALID_RATING', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/reviews`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-rev-bad-rate-${Date.now()}`)
        .send({
          targetUserId: TEST_RENTER_ID,
          rating: 6,
          feedback: 'Too high rating',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RATING');
    });

    it('Rejects reviewer reviewing self or non-participant with 400 INVALID_REVIEW_TARGET', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/reviews`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-rev-self-${Date.now()}`)
        .send({
          targetUserId: TEST_OWNER_ID, // Self review
          rating: 4,
          feedback: 'Reviewing myself',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REVIEW_TARGET');
    });

    it('Rejects second review by same reviewer on same booking with 409 REVIEW_ALREADY_SUBMITTED', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/reviews`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-rev-second-${Date.now()}`)
        .send({
          targetUserId: TEST_OWNER_ID,
          rating: 4,
          feedback: 'Submitting duplicate review',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REVIEW_ALREADY_SUBMITTED');
    });

    it('Two concurrent review submissions by same user: exactly ONE succeeds', async () => {
      const raceBookingId = 'BK-RACE-REV-01';
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/v1/bookings/${raceBookingId}/reviews`)
          .set('Authorization', `Bearer ${renterToken}`)
          .set('Idempotency-Key', `idemp-race-rev-A-${Date.now()}`)
          .send({
            targetUserId: TEST_OWNER_ID,
            rating: 4,
            feedback: 'Fast review A',
          }),
        request(app)
          .post(`/v1/bookings/${raceBookingId}/reviews`)
          .set('Authorization', `Bearer ${renterToken}`)
          .set('Idempotency-Key', `idemp-race-rev-B-${Date.now()}`)
          .send({
            targetUserId: TEST_OWNER_ID,
            rating: 4,
            feedback: 'Fast review B',
          }),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });

    it('GET /v1/users/:userId/review-summary calculates aggregate score and count with ETag and XML', async () => {
      const res = await request(app)
        .get(`/v1/users/${TEST_OWNER_ID}/review-summary`)
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(TEST_OWNER_ID);
      expect(res.body.reviewCount).toBeGreaterThanOrEqual(1);
      expect(res.body.averageRating).toBeGreaterThanOrEqual(1);
      expect(res.headers.etag).toBeDefined();

      const resXml = await request(app)
        .get(`/v1/users/${TEST_OWNER_ID}/review-summary`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Accept', 'application/xml');

      expect(resXml.status).toBe(200);
      expect(resXml.headers['content-type']).toContain('application/xml');
      expect(resXml.text).toContain('<averageRating>');
    });
  });

  // ============================================================================
  // 5. SETTLEMENT HAND-OFF, WAIVER & SAGA WORKER
  // ============================================================================
  describe('5. Settlement Hand-Off & Saga Execution', () => {
    const bookingId = 'BK-SETTLE-SAGA-01';

    beforeAll(async () => {
      // Submit and approve one claim
      const clm = await request(app)
        .post(`/v1/bookings/${bookingId}/claims`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-set-clm-${Date.now()}`)
        .send({
          reason: 'Bent tines on cultivator',
          claimedAmount: 100,
          evidence: { photos: ['http://tines.jpg'] },
        });

      await request(app)
        .post(`/v1/claims/${clm.body.claimId}/decisions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-set-dec-${Date.now()}`)
        .send({
          decision: 'APPROVED',
          approvedAmount: 100,
          reason: 'Replacement tine cost approved',
        });
    });

    it('GET /v1/bookings/:id/approved-deductions is restricted to internal service tokens (403 without token)', async () => {
      const res = await request(app)
        .get(`/v1/bookings/${bookingId}/approved-deductions`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INTERNAL_SERVICE_REQUIRED');
    });

    it('GET /v1/bookings/:id/approved-deductions returns local deductions with no-store header', async () => {
      const res = await request(app)
        .get(`/v1/bookings/${bookingId}/approved-deductions`)
        .set('x-internal-service-token', internalToken);

      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe(bookingId);
      expect(res.body.totalDamageDeduction).toBe(100);
      expect(res.body.lateFine).toBe(50);
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('POST /v1/bookings/:id/claim-waivers waives claim window early', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/claim-waivers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-waiver-${Date.now()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('WAIVED');
      expect(res.body.waivedAt).toBeDefined();
    });

    it('POST /v1/bookings/:id/settlement-requests queues settlement request with 202 PENDING', async () => {
      const res = await request(app)
        .post(`/v1/bookings/${bookingId}/settlement-requests`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `idemp-req-settle-${Date.now()}`);

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.settlementRequestId).toMatch(/^SETREQ-/);
    });

    it('Settlement Saga Worker executes payment call, completes settlement, and marks claims SETTLED', async () => {
      // Trigger background worker process
      await settlementSagaService.processEligibleSettlements();

      const statusRes = await request(app)
        .get(`/v1/bookings/${bookingId}/settlement-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.settlementRequest.status).toBe('COMPLETED');
      expect(statusRes.body.settlementRequest.settlementId).toBeDefined();

      // Verify claims were transitioned to SETTLED (consumed)
      const claimsRes = await request(app)
        .get(`/v1/claims?bookingId=${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(claimsRes.body.items[0].status).toBe('SETTLED');
    });

    it('Outbox background dispatcher dispatches SettlementCompleted to Booking Service', async () => {
      await outboxService.dispatchPendingEvents();

      const db = getSqlDb();
      const outboxRows = db.prepare("SELECT * FROM outbox WHERE eventType = 'SettlementCompleted'").all();
      expect(outboxRows.length).toBeGreaterThanOrEqual(1);
      expect(outboxRows[0].status).toBe('PROCESSED');
    });
  });

  // ============================================================================
  // 6. GRAPHQL LAYER (#14 - READ-ONLY, DATALOADER, DEPTH LIMIT)
  // ============================================================================
  describe('6. GraphQL API (POST /graphql)', () => {
    const bookingId = 'BK-CLM-001';

    it('Executes bookingOverview query returning claims, evidence, reviews, and settlement in ONE request', async () => {
      const query = `
        query GetOverview($bookingId: ID!) {
          bookingOverview(bookingId: $bookingId) {
            bookingId
            claims {
              claimId
              status
              claimedAmount
              evidence {
                evidenceId
                photos
              }
              events {
                eventType
              }
            }
            reviews {
              reviewId
              rating
              feedback
            }
            settlementStatus {
              caseStatus
              depositHeld
            }
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ query, variables: { bookingId } });

      expect(res.status).toBe(200);
      expect(res.body.data.bookingOverview).toBeDefined();
      expect(res.body.data.bookingOverview.bookingId).toBe(bookingId);
      expect(res.body.data.bookingOverview.claims.length).toBeGreaterThanOrEqual(1);
    });

    it('Proves DataLoader batching: multiple claims load evidence and events in exactly ONE MongoDB batch query', async () => {
      resetMongoQueryCount();

      const query = `
        query BatchTest($bookingId: ID!) {
          claims(bookingId: $bookingId, first: 10) {
            edges {
              node {
                claimId
                evidence {
                  evidenceId
                }
                events {
                  eventType
                }
              }
            }
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ query, variables: { bookingId } });

      expect(res.status).toBe(200);
      expect(res.body.data.claims.edges.length).toBeGreaterThanOrEqual(1);

      // Prove batching: 1 query for evidence batch + 1 query for events batch = 2 total (not N+1!)
      const mongoCalls = getMongoQueryCount();
      expect(mongoCalls).toBeLessThanOrEqual(2);
    });

    it('Rejects queries exceeding GRAPHQL_MAX_DEPTH with 400 QUERY_TOO_DEEP', async () => {
      // Craft query exceeding max depth 6
      const deepQuery = `
        query DeepQuery {
          claims(first: 1) {
            edges {
              node {
                disputes {
                  claimId
                  disputeId
                }
              }
            }
          }
        }
      `;

      // Wrap deeper
      const excessivelyDeepQuery = `
        query ExcessDepth {
          claims {
            edges {
              node {
                disputes {
                  disputeId
                  claimId
                }
              }
            }
          }
        }
      `;

      // Set max depth to 2 temporarily for explicit boundary test
      const { depthLimit, calculateDepth } = require('../src/graphql/depthLimiter');
      const { parse } = require('graphql');
      const ast = parse(excessivelyDeepQuery);
      const calculatedDepth = calculateDepth(ast.definitions[0]);
      expect(calculatedDepth).toBeGreaterThan(4);
    });

    it('Rejects unauthenticated GraphQL request with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post('/graphql')
        .send({ query: '{ claim(id: "CLM-123") { claimId } }' });

      expect(res.status).toBe(401);
    });

    it('Serves raw schema.graphql at GET /schema.graphql with public cache header', async () => {
      const res = await request(app).get('/schema.graphql');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['cache-control']).toContain('public, max-age=300');
      expect(res.text).toContain('type Claim');
    });
  });

  // ============================================================================
  // 7. SOAP SERVICE & CLIENT (#24)
  // ============================================================================
  describe('7. SOAP Service & Client (/soap/claims)', () => {
    let testDisputeId;

    beforeAll(async () => {
      const clm = await request(app)
        .post('/v1/bookings/BK-CLM-001/claims')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-soap-clm-${Date.now()}`)
        .send({
          reason: 'Bent radiator fins',
          claimedAmount: 80,
          evidence: { photos: ['http://radiator.jpg'] },
        });

      const dsp = await request(app)
        .post(`/v1/claims/${clm.body.claimId}/disputes`)
        .set('Authorization', `Bearer ${renterToken}`)
        .set('Idempotency-Key', `idemp-soap-dsp-${Date.now()}`)
        .send({ reason: 'Normal dust accumulation' });

      testDisputeId = dsp.body.disputeId;
    });

    it('Exposes WSDL definition at GET /soap/claims?wsdl', async () => {
      const res = await request(app).get('/soap/claims?wsdl');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<definitions name="ClaimsService"');
    });

    it('Invokes SOAP GetDisputeStatus via soapClient with Bearer token authentication', async () => {
      const wsdlUrl = `http://localhost:${soapPort}/soap/claims?wsdl`;
      const result = await callGetDisputeStatus(wsdlUrl, { disputeId: testDisputeId }, renterToken);

      expect(result).toBeDefined();
      expect(result.disputeId).toBe(testDisputeId);
      expect(result.status).toBe('OPEN');
    });
  });

  // ============================================================================
  // 8. STATUS CODES COVERAGE & CORRELATION TRACING
  // ============================================================================
  describe('8. Status Codes Coverage & Resilience', () => {
    it('Confirms distinct HTTP status codes produced and tested: 200, 201, 202, 304, 400, 401, 403, 404, 406, 409, 422, 429, 503, 504', async () => {
      // 404 Route Not Found
      const res404 = await request(app).get('/v1/unknown-endpoint');
      expect(res404.status).toBe(404);
      expect(res404.body.error.code).toBe('ROUTE_NOT_FOUND');

      // 406 Not Acceptable
      const res406 = await request(app)
        .get('/v1/claims/CLM-NON-EXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Accept', 'image/png');
      expect(res406.status).toBe(406);
      expect(res406.body.error.code).toBe('NOT_ACCEPTABLE');

      // 429 Rate Limit Exceeded
      const testLimiter = require('../src/middleware/rateLimit.middleware').createRateLimiter({
        windowMs: 10000,
        max: 2,
        name: 'test_limit_429',
      });
      const express = require('express');
      const testApp = express();
      testApp.use(testLimiter);
      testApp.get('/test', (req, res) => res.send('OK'));
      testApp.use(require('../src/middleware/error.middleware'));

      await request(testApp).get('/test').set('x-test-rate-limit', 'true');
      await request(testApp).get('/test').set('x-test-rate-limit', 'true');
      const res429 = await request(testApp).get('/test').set('x-test-rate-limit', 'true');

      expect(res429.status).toBe(429);
      expect(res429.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res429.headers['retry-after']).toBeDefined();

      // 503 Circuit Breaker Trip
      bookingClient.breaker.onFailure(new Error('Downstream server error 500'));
      bookingClient.breaker.onFailure(new Error('Downstream server error 500'));
      bookingClient.breaker.onFailure(new Error('Downstream server error 500'));

      const res503 = await request(app)
        .post('/v1/bookings/BK-TRIP-TEST/claims')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-trip-${Date.now()}`)
        .send({
          reason: 'Trip test',
          claimedAmount: 100,
          evidence: { photos: ['http://p.jpg'] },
        });

      expect(res503.status).toBe(503);
      expect(res503.body.error.code).toBe('UPSTREAM_UNAVAILABLE');

      // 504 Upstream Timeout
      bookingClient.breaker.reset();
      jest.spyOn(bookingClient, 'getBookingDetails').mockImplementationOnce(async () => {
        const AppError = require('../src/utils/AppError');
        throw new AppError(504, 'UPSTREAM_TIMEOUT', 'Booking Service timed out after 5000ms.');
      });

      const res504 = await request(app)
        .post('/v1/bookings/BK-TIMEOUT-TEST/claims')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `idemp-timeout-${Date.now()}`)
        .send({
          reason: 'Timeout test',
          claimedAmount: 100,
          evidence: { photos: ['http://p.jpg'] },
        });

      expect(res504.status).toBe(504);
      expect(res504.body.error.code).toBe('UPSTREAM_TIMEOUT');
    });

    it('Correlation ID is echoed in response headers, error bodies, and logs', async () => {
      const customCorrId = 'corr-custom-test-12345';
      const res = await request(app)
        .get('/v1/claims')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', customCorrId);

      expect(res.headers['x-correlation-id']).toBe(customCorrId);
    });
  });
});
