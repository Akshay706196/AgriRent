const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const Booking = require('../src/models/Booking');
const ReservationLock = require('../src/models/ReservationLock');
const { generateToken } = require('../src/middleware/auth.middleware');
const { expirePendingBookings } = require('../src/jobs/expireBookings.job');
const axios = require('axios');

jest.mock('axios');

let mongoServer;

const verifiedRenterToken = generateToken({
  sub: 'RENTER_001',
  role: 'USER',
  kycStatus: 'VERIFIED',
});

const unverifiedRenterToken = generateToken({
  sub: 'RENTER_UNVERIFIED',
  role: 'USER',
  kycStatus: 'PENDING',
});

const equipmentOwnerToken = generateToken({
  sub: 'OWNER_001',
  role: 'OWNER',
  kycStatus: 'VERIFIED',
});

const differentOwnerToken = generateToken({
  sub: 'OWNER_999',
  role: 'OWNER',
  kycStatus: 'VERIFIED',
});

const unauthorizedUserToken = generateToken({
  sub: 'STRANGER_123',
  role: 'USER',
  kycStatus: 'VERIFIED',
});

const mockActiveEquipment = {
  equipmentId: 'EQ-TEST-100',
  ownerId: 'OWNER_001',
  name: 'Mahindra 575 DI',
  category: 'TRACTOR',
  pricePerDay: 2500,
  securityDeposit: 5000,
  status: 'ACTIVE',
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
  await ReservationLock.deleteMany({});
  jest.clearAllMocks();
});

describe('Booking Service API Suite', () => {
  describe('POST /api/v1/bookings (Create Booking)', () => {
    it('should create booking request with accurate price snapshot calculation', async () => {
      axios.get.mockResolvedValueOnce({ data: mockActiveEquipment });

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-01',
          endDate: '2026-11-03', // 2 rental days
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('bookingId');
      expect(res.body.status).toBe('PENDING_OWNER');
      expect(res.body.rentalDays).toBe(2);
      expect(res.body.pricePerDaySnapshot).toBe(2500);
      expect(res.body.rentalAmount).toBe(5000); // 2 * 2500
      expect(res.body.platformFee).toBe(150); // 3% of 5000
      expect(res.body.securityDeposit).toBe(5000);
      expect(res.body.totalAmount).toBe(10150); // 5000 + 150 + 5000
      expect(res.body.renterId).toBe('RENTER_001');
      expect(res.body.ownerId).toBe('OWNER_001');
      expect(res.body).toHaveProperty('ownerResponseDeadline');
    });

    it('should reject booking if renter is not KYC-verified (403 KYC_REQUIRED)', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${unverifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KYC_REQUIRED');
    });

    it('should reject booking when owner tries to rent their own equipment', async () => {
      axios.get.mockResolvedValueOnce({ data: mockActiveEquipment }); // ownerId is OWNER_001

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${equipmentOwnerToken}`) // caller is OWNER_001
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_RENT_OWN_EQUIPMENT');
    });

    it('should reject invalid date range (endDate <= startDate)', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-05',
          endDate: '2026-11-02',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject booking when equipment listing is INACTIVE or MAINTENANCE', async () => {
      axios.get.mockResolvedValueOnce({
        data: { ...mockActiveEquipment, status: 'MAINTENANCE' },
      });

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EQUIPMENT_NOT_AVAILABLE');
    });

    it('should handle Equipment Service outage gracefully with 503 EQUIPMENT_SERVICE_UNAVAILABLE', async () => {
      axios.get.mockRejectedValue(new Error('Connection refused'));

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
        });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('EQUIPMENT_SERVICE_UNAVAILABLE');
    });

    it('should return existing booking when Idempotency-Key is reused', async () => {
      axios.get.mockResolvedValueOnce({ data: mockActiveEquipment });

      const payload = {
        equipmentId: 'EQ-TEST-100',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
      };

      // First call
      const res1 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .set('Idempotency-Key', 'idemp-abc-123')
        .send(payload);

      expect(res1.status).toBe(201);
      const bookingId = res1.body.bookingId;

      // Duplicate retry with same idempotency key
      const res2 = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .set('Idempotency-Key', 'idemp-abc-123')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.bookingId).toBe(bookingId);
    });
  });

  describe('Date Overlap & Concurrency Reservation Prevention', () => {
    beforeEach(async () => {
      // Seed an existing reserving booking for Nov 1 to Nov 5
      await Booking.create({
        bookingId: 'BK-EXISTING',
        equipmentId: 'EQ-TEST-100',
        ownerId: 'OWNER_001',
        renterId: 'RENTER_EXISTING',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-05'),
        rentalDays: 4,
        pricePerDaySnapshot: 2500,
        rentalAmount: 10000,
        platformFee: 300,
        securityDeposit: 5000,
        totalAmount: 15300,
        currency: 'INR',
        status: 'PENDING_OWNER',
        ownerResponseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it('should reject overlapping booking request with 409 DATE_CONFLICT', async () => {
      axios.get.mockResolvedValueOnce({ data: mockActiveEquipment });

      // Overlaps Nov 1 - Nov 5
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-03',
          endDate: '2026-11-07',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DATE_CONFLICT');
    });

    it('should allow adjacent, non-overlapping booking under half-open [startDate, endDate) convention', async () => {
      axios.get.mockResolvedValueOnce({ data: mockActiveEquipment });

      // Nov 5 to Nov 8 is adjacent (existing booking ends on Nov 5 exclusive)
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({
          equipmentId: 'EQ-TEST-100',
          startDate: '2026-11-05',
          endDate: '2026-11-08',
        });

      expect(res.status).toBe(201);
      expect(res.body.rentalDays).toBe(3);
    });

    it('should handle two concurrent booking requests safely without double-booking', async () => {
      // Clear bookings
      await Booking.deleteMany({});
      axios.get.mockResolvedValue({ data: mockActiveEquipment });

      const reqPayload = {
        equipmentId: 'EQ-TEST-100',
        startDate: '2026-11-10',
        endDate: '2026-11-15',
      };

      // Fire 2 concurrent requests for the exact same slot
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${verifiedRenterToken}`)
          .send(reqPayload),
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${verifiedRenterToken}`)
          .send(reqPayload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one succeeds (201) and one conflicts (409)
      expect(statuses).toEqual([201, 409]);

      const totalCreated = await Booking.countDocuments({ equipmentId: 'EQ-TEST-100' });
      expect(totalCreated).toBe(1);
    });
  });

  describe('Approval, Rejection, and Cancellation Lifecycle', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await Booking.create({
        bookingId: 'BK-TO-APPROVE',
        equipmentId: 'EQ-TEST-100',
        ownerId: 'OWNER_001',
        renterId: 'RENTER_001',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-03'),
        rentalDays: 2,
        pricePerDaySnapshot: 2500,
        rentalAmount: 5000,
        platformFee: 150,
        securityDeposit: 5000,
        totalAmount: 10150,
        currency: 'INR',
        status: 'PENDING_OWNER',
        ownerResponseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it('should allow equipment owner to approve booking request', async () => {
      const res = await request(app)
        .patch(`/api/v1/bookings/${testBooking.bookingId}/approve`)
        .set('Authorization', `Bearer ${equipmentOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body).toHaveProperty('approvedAt');
    });

    it('should reject approval if caller is not the equipment owner (403 NOT_EQUIPMENT_OWNER)', async () => {
      const res = await request(app)
        .patch(`/api/v1/bookings/${testBooking.bookingId}/approve`)
        .set('Authorization', `Bearer ${differentOwnerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_EQUIPMENT_OWNER');
    });

    it('should reject approval if 24-hour deadline has elapsed (409 BOOKING_EXPIRED)', async () => {
      // Set deadline to past
      testBooking.ownerResponseDeadline = new Date(Date.now() - 3600000); // 1 hour ago
      await testBooking.save();

      const res = await request(app)
        .patch(`/api/v1/bookings/${testBooking.bookingId}/approve`)
        .set('Authorization', `Bearer ${equipmentOwnerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BOOKING_EXPIRED');

      const updated = await Booking.findOne({ bookingId: testBooking.bookingId });
      expect(updated.status).toBe('EXPIRED');
    });

    it('should allow owner to reject booking with reason', async () => {
      const res = await request(app)
        .patch(`/api/v1/bookings/${testBooking.bookingId}/reject`)
        .set('Authorization', `Bearer ${equipmentOwnerToken}`)
        .send({ reason: 'Equipment scheduled for engine maintenance' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.rejectionReason).toBe('Equipment scheduled for engine maintenance');
    });

    it('should reject invalid state transitions (cannot approve an already rejected booking)', async () => {
      testBooking.status = 'REJECTED';
      await testBooking.save();

      const res = await request(app)
        .patch(`/api/v1/bookings/${testBooking.bookingId}/approve`)
        .set('Authorization', `Bearer ${equipmentOwnerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should allow renter to cancel pending booking with 100% refund eligibility', async () => {
      const res = await request(app)
        .patch(`/api/v1/bookings/${testBooking.bookingId}/cancel`)
        .set('Authorization', `Bearer ${verifiedRenterToken}`)
        .send({ reason: 'Farming schedule changed' });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('CANCELLED');
      expect(res.body.refundEligibility.percentage).toBe(100);
    });
  });

  describe('Automatic 24-Hour Expiry Engine', () => {
    it('should automatically transition overdue pending bookings to EXPIRED', async () => {
      // Create one overdue and one active booking
      await Booking.create([
        {
          bookingId: 'BK-OVERDUE',
          equipmentId: 'EQ-1',
          ownerId: 'OWNER_001',
          renterId: 'RENTER_001',
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-03'),
          rentalDays: 2,
          pricePerDaySnapshot: 2000,
          rentalAmount: 4000,
          platformFee: 120,
          securityDeposit: 3000,
          totalAmount: 7120,
          status: 'PENDING_OWNER',
          ownerResponseDeadline: new Date(Date.now() - 10000), // In the past
        },
        {
          bookingId: 'BK-STILL-ACTIVE',
          equipmentId: 'EQ-2',
          ownerId: 'OWNER_001',
          renterId: 'RENTER_001',
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-03'),
          rentalDays: 2,
          pricePerDaySnapshot: 2000,
          rentalAmount: 4000,
          platformFee: 120,
          securityDeposit: 3000,
          totalAmount: 7120,
          status: 'PENDING_OWNER',
          ownerResponseDeadline: new Date(Date.now() + 86400000), // In the future
        },
      ]);

      const { expiredCount } = await expirePendingBookings();
      expect(expiredCount).toBe(1);

      const overdueBooking = await Booking.findOne({ bookingId: 'BK-OVERDUE' });
      expect(overdueBooking.status).toBe('EXPIRED');
      expect(overdueBooking).toHaveProperty('expiredAt');

      const activeBooking = await Booking.findOne({ bookingId: 'BK-STILL-ACTIVE' });
      expect(activeBooking.status).toBe('PENDING_OWNER');
    });
  });

  describe('Authorization on Booking Details', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await Booking.create({
        bookingId: 'BK-PRIVATE',
        equipmentId: 'EQ-TEST-100',
        ownerId: 'OWNER_001',
        renterId: 'RENTER_001',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-03'),
        rentalDays: 2,
        pricePerDaySnapshot: 2500,
        rentalAmount: 5000,
        platformFee: 150,
        securityDeposit: 5000,
        totalAmount: 10150,
        status: 'PENDING_OWNER',
        ownerResponseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it('should allow authorized renter to view booking details', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${testBooking.bookingId}`)
        .set('Authorization', `Bearer ${verifiedRenterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe('BK-PRIVATE');
    });

    it('should allow authorized owner to view booking details', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${testBooking.bookingId}`)
        .set('Authorization', `Bearer ${equipmentOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe('BK-PRIVATE');
    });

    it('should reject unauthorized 3rd-party user with 403 ACCESS_DENIED', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${testBooking.bookingId}`)
        .set('Authorization', `Bearer ${unauthorizedUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('GET /api/v1/bookings/availability', () => {
    it('should return available: true when no reserving bookings exist', async () => {
      const res = await request(app).get(
        '/api/v1/bookings/availability?equipmentId=EQ-TEST-100&startDate=2026-11-01&endDate=2026-11-03'
      );

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
      expect(res.body.conflictingBookingsCount).toBe(0);
    });

    it('should return available: false when reserving booking overlaps', async () => {
      await Booking.create({
        bookingId: 'BK-RESERVED',
        equipmentId: 'EQ-TEST-100',
        ownerId: 'OWNER_001',
        renterId: 'RENTER_001',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-04'),
        rentalDays: 3,
        pricePerDaySnapshot: 2500,
        rentalAmount: 7500,
        platformFee: 225,
        securityDeposit: 5000,
        totalAmount: 12725,
        status: 'APPROVED',
        ownerResponseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app).get(
        '/api/v1/bookings/availability?equipmentId=EQ-TEST-100&startDate=2026-11-02&endDate=2026-11-05'
      );

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.conflictingBookingsCount).toBe(1);
    });
  });
});
