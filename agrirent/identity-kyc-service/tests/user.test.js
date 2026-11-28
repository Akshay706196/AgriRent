const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Identity & KYC Service — User Profile & Eligibility Suite', () => {
  let userToken;
  let testUserId;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Farmer Ramesh',
      email: 'ramesh@example.com',
      phone: '+919123456789',
      password: 'StrongPassword123!',
    });
    testUserId = regRes.body.data.userId;

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: 'ramesh@example.com',
      password: 'StrongPassword123!',
    });
    userToken = loginRes.body.data.accessToken;
  });

  describe('GET & PATCH /api/v1/users/me', () => {
    it('should retrieve own profile details', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(testUserId);
      expect(res.body.data.name).toBe('Farmer Ramesh');
    });

    it('should update permitted profile fields (name and phone)', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Ramesh Patel',
          phone: '+919876500000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Ramesh Patel');
      expect(res.body.data.phone).toBe('+919876500000');
    });

    it('should reject attempts to update roles or account status (422)', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          roles: ['ADMIN'],
          accountStatus: 'SUSPENDED',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET /api/v1/users/:userId/eligibility (Service-to-Service Contract)', () => {
    const serviceHeaders = {
      'x-service-client-id': 'agrirent_internal_client',
      'x-service-client-secret': 'agrirent_internal_secret_key_2026',
    };

    it('should reject unauthenticated caller (401)', async () => {
      const res = await request(app).get(`/api/v1/users/${testUserId}/eligibility`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return canRent: false when user has NOT_SUBMITTED KYC status', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${testUserId}/eligibility`)
        .set(serviceHeaders);

      expect(res.status).toBe(200);
      expect(res.body.data.exists).toBe(true);
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(res.body.data.kycStatus).toBe('NOT_SUBMITTED');
      expect(res.body.data.canRent).toBe(false);
      expect(res.body.data.canListEquipment).toBe(false);
    });

    it('should return canRent: true and canListEquipment: true when user is ACTIVE and VERIFIED', async () => {
      await User.updateOne({ userId: testUserId }, { kycStatus: 'VERIFIED' });

      const res = await request(app)
        .get(`/api/v1/users/${testUserId}/eligibility`)
        .set(serviceHeaders);

      expect(res.status).toBe(200);
      expect(res.body.data.kycStatus).toBe('VERIFIED');
      expect(res.body.data.canRent).toBe(true);
      expect(res.body.data.canListEquipment).toBe(true);
    });

    it('should return canRent: false when user is SUSPENDED even if KYC is VERIFIED', async () => {
      await User.updateOne(
        { userId: testUserId },
        { kycStatus: 'VERIFIED', accountStatus: 'SUSPENDED' }
      );

      const res = await request(app)
        .get(`/api/v1/users/${testUserId}/eligibility`)
        .set(serviceHeaders);

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('SUSPENDED');
      expect(res.body.data.canRent).toBe(false);
      expect(res.body.data.canListEquipment).toBe(false);
    });

    it('should return exists: false for unknown userId', async () => {
      const res = await request(app)
        .get('/api/v1/users/USR-NONEXISTENT/eligibility')
        .set(serviceHeaders);

      expect(res.status).toBe(200);
      expect(res.body.data.exists).toBe(false);
      expect(res.body.data.canRent).toBe(false);
    });
  });
});
