const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const Equipment = require('../src/models/Equipment');
const { generateToken } = require('../src/middleware/auth.middleware');
const axios = require('axios');

jest.mock('axios');

let mongoServer;

const verifiedOwnerToken = generateToken({
  sub: 'OWNER_001',
  role: 'OWNER',
  kycStatus: 'VERIFIED',
});

const unverifiedOwnerToken = generateToken({
  sub: 'OWNER_UNVERIFIED',
  role: 'OWNER',
  kycStatus: 'PENDING',
});

const otherUserToken = generateToken({
  sub: 'USER_999',
  role: 'USER',
  kycStatus: 'VERIFIED',
});

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
  await Equipment.deleteMany({});
  jest.clearAllMocks();
});

describe('Equipment Service API Suite', () => {
  const validEquipmentPayload = {
    name: 'John Deere 5310 Tractor',
    category: 'TRACTOR',
    description: '55 HP tractor equipped with modern hydraulics',
    brand: 'John Deere',
    model: '5310',
    manufacturingYear: 2021,
    condition: 'GOOD',
    photos: ['https://example.com/tractor1.jpg'],
    pricePerDay: 3000,
    securityDeposit: 6000,
    pickupAddress: {
      address: 'Plot 12, Agro Hub',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
    },
    status: 'ACTIVE',
  };

  describe('POST /api/v1/equipment', () => {
    it('should create an equipment listing when authenticated with verified KYC', async () => {
      const res = await request(app)
        .post('/api/v1/equipment')
        .set('Authorization', `Bearer ${verifiedOwnerToken}`)
        .send(validEquipmentPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('equipmentId');
      expect(res.body.name).toBe(validEquipmentPayload.name);
      expect(res.body.ownerId).toBe('OWNER_001');
      expect(res.body.pricePerDay).toBe(3000);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('should reject creation if caller lacks KYC verification (403 KYC_REQUIRED)', async () => {
      const res = await request(app)
        .post('/api/v1/equipment')
        .set('Authorization', `Bearer ${unverifiedOwnerToken}`)
        .send(validEquipmentPayload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KYC_REQUIRED');
    });

    it('should reject creation if token is missing (401 UNAUTHENTICATED)', async () => {
      const res = await request(app)
        .post('/api/v1/equipment')
        .send(validEquipmentPayload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should reject missing or invalid fields with 422 VALIDATION_FAILED', async () => {
      const invalidPayload = { ...validEquipmentPayload };
      delete invalidPayload.name;
      invalidPayload.pricePerDay = -100;

      const res = await request(app)
        .post('/api/v1/equipment')
        .set('Authorization', `Bearer ${verifiedOwnerToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/equipment/:equipmentId', () => {
    it('should retrieve existing equipment listing', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      const res = await request(app).get(`/api/v1/equipment/${created.equipmentId}`);

      expect(res.status).toBe(200);
      expect(res.body.equipmentId).toBe(created.equipmentId);
      expect(res.body.name).toBe(created.name);
    });

    it('should return 404 EQUIPMENT_NOT_FOUND for nonexistent ID', async () => {
      const res = await request(app).get('/api/v1/equipment/EQ-NONEXISTENT');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EQUIPMENT_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/equipment/:equipmentId', () => {
    it('should allow owner to update listing details', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      const res = await request(app)
        .patch(`/api/v1/equipment/${created.equipmentId}`)
        .set('Authorization', `Bearer ${verifiedOwnerToken}`)
        .send({ pricePerDay: 3500, description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.pricePerDay).toBe(3500);
      expect(res.body.description).toBe('Updated description');
    });

    it('should reject update if requester is not the owner (403 NOT_EQUIPMENT_OWNER)', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      const res = await request(app)
        .patch(`/api/v1/equipment/${created.equipmentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ pricePerDay: 3500 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_EQUIPMENT_OWNER');
    });
  });

  describe('DELETE /api/v1/equipment/:equipmentId', () => {
    it('should allow owner to safely deactivate equipment when no active bookings exist', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      axios.get.mockResolvedValueOnce({
        data: { conflictingBookingsCount: 0, available: true },
      });

      const res = await request(app)
        .delete(`/api/v1/equipment/${created.equipmentId}`)
        .set('Authorization', `Bearer ${verifiedOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.equipmentId).toBe(created.equipmentId);

      const inDb = await Equipment.findOne({ equipmentId: created.equipmentId });
      expect(inDb.status).toBe('INACTIVE');
      expect(inDb.isDeleted).toBe(true);
    });

    it('should prevent deactivation if Booking Service reports active bookings (409)', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      axios.get.mockResolvedValueOnce({
        data: { conflictingBookingsCount: 2, available: false },
      });

      const res = await request(app)
        .delete(`/api/v1/equipment/${created.equipmentId}`)
        .set('Authorization', `Bearer ${verifiedOwnerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EQUIPMENT_HAS_ACTIVE_BOOKINGS');
    });
  });

  describe('GET /api/v1/equipment (Search & Filter)', () => {
    beforeEach(async () => {
      await Equipment.create([
        {
          ...validEquipmentPayload,
          name: 'Tractor 1',
          category: 'TRACTOR',
          ownerId: 'OWNER_001',
          pricePerDay: 2000,
          pickupAddress: { address: 'A1', city: 'Pune', state: 'MH', postalCode: '411001' },
        },
        {
          ...validEquipmentPayload,
          name: 'Rotavator 1',
          category: 'ROTAVATOR',
          ownerId: 'OWNER_001',
          pricePerDay: 1500,
          pickupAddress: { address: 'A2', city: 'Nashik', state: 'MH', postalCode: '422001' },
        },
        {
          ...validEquipmentPayload,
          name: 'Tractor 2',
          category: 'TRACTOR',
          ownerId: 'OWNER_002',
          pricePerDay: 4000,
          pickupAddress: { address: 'A3', city: 'Pune', state: 'MH', postalCode: '411001' },
        },
      ]);
    });

    it('should filter listings by category and city', async () => {
      const res = await request(app).get('/api/v1/equipment?category=TRACTOR&city=Pune');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should filter listings by price range', async () => {
      const res = await request(app).get('/api/v1/equipment?minPrice=1000&maxPrice=2500');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter listings by ownerId', async () => {
      const res = await request(app).get('/api/v1/equipment?ownerId=OWNER_002');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Tractor 2');
    });

    it('should filter listings by text search query q', async () => {
      const res = await request(app).get('/api/v1/equipment?q=Rotavator');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Rotavator 1');
    });

    it('should treat status=AVAILABLE as ACTIVE listings', async () => {
      const res = await request(app).get('/api/v1/equipment?status=AVAILABLE');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });
  });

  describe('GET /api/v1/equipment/my-equipment', () => {
    it('should return all equipment belonging to authenticated owner', async () => {
      await Equipment.create([
        {
          ...validEquipmentPayload,
          name: 'Owner 1 Harvester',
          category: 'HARVESTER',
          ownerId: 'OWNER_001',
        },
        {
          ...validEquipmentPayload,
          name: 'Owner 2 Seeder',
          category: 'SEEDER',
          ownerId: 'OWNER_002',
        },
      ]);

      const res = await request(app)
        .get('/api/v1/equipment/my-equipment')
        .set('Authorization', `Bearer ${verifiedOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].ownerId).toBe('OWNER_001');
      expect(res.body.data[0].name).toBe('Owner 1 Harvester');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/equipment/my-equipment');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/equipment/:equipmentId/availability', () => {
    it('should return availability status from Booking Service', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      axios.get.mockResolvedValueOnce({
        data: {
          equipmentId: created.equipmentId,
          startDate: '2026-11-01',
          endDate: '2026-11-03',
          available: true,
        },
      });

      const res = await request(app).get(
        `/api/v1/equipment/${created.equipmentId}/availability?startDate=2026-11-01&endDate=2026-11-03`
      );

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
      expect(res.body.equipmentId).toBe(created.equipmentId);
    });

    it('should handle Booking Service outage with 503 DEPENDENCY_UNAVAILABLE', async () => {
      const created = await Equipment.create({
        ...validEquipmentPayload,
        ownerId: 'OWNER_001',
      });

      axios.get.mockRejectedValueOnce(new Error('Network connection timeout'));

      const res = await request(app).get(
        `/api/v1/equipment/${created.equipmentId}/availability?startDate=2026-11-01&endDate=2026-11-03`
      );

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    });
  });
});
