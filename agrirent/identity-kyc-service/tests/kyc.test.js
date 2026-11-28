const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const KYCSubmission = require('../src/models/KYCSubmission');

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
  await KYCSubmission.deleteMany({});
});

describe('Identity & KYC Service — KYC Submission Suite', () => {
  let userToken;
  let testUserId;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Sunita Sharma',
      email: 'sunita@example.com',
      phone: '+919988776655',
      password: 'StrongPassword123!',
    });
    testUserId = regRes.body.data.userId;

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: 'sunita@example.com',
      password: 'StrongPassword123!',
    });
    userToken = loginRes.body.data.accessToken;
  });

  describe('POST /api/v1/kyc/submit', () => {
    it('should submit valid KYC information and update user summary status to PENDING', async () => {
      const res = await request(app)
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'GOVERNMENT_ID',
          documentReference: 'storage://agrirent-kyc-docs/gov-id-sunita-01.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('kycId');
      expect(res.body.data.status).toBe('PENDING');

      // Verify user summary status in DB
      const user = await User.findOne({ userId: testUserId });
      expect(user.kycStatus).toBe('PENDING');
    });

    it('should reject duplicate active submission when previous is PENDING (409)', async () => {
      // First submission
      await request(app)
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'GOVERNMENT_ID',
          documentReference: 'storage://agrirent-kyc-docs/gov-id-sunita-01.pdf',
        });

      // Attempt duplicate
      const res = await request(app)
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'FARMER_ID',
          documentReference: 'storage://agrirent-kyc-docs/farmer-id-sunita.pdf',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('KYC_ALREADY_PENDING');
    });

    it('should reject unsupported documentType (422)', async () => {
      const res = await request(app)
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'INVALID_DOC_TYPE',
          documentReference: 'storage://ref123',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET /api/v1/kyc/me & /history', () => {
    it('should retrieve own KYC status and history', async () => {
      await request(app)
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'AADHAAR',
          documentReference: 'storage://aadhaar-ref-1',
        });

      const statusRes = await request(app)
        .get('/api/v1/kyc/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.kycStatus).toBe('PENDING');
      expect(statusRes.body.data.latestSubmission.documentType).toBe('AADHAAR');

      const historyRes = await request(app)
        .get('/api/v1/kyc/me/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.length).toBe(1);
    });
  });
});
