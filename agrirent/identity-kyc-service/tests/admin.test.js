const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const KYCSubmission = require('../src/models/KYCSubmission');
const AuditLog = require('../src/models/AuditLog');

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
  await AuditLog.deleteMany({});
});

describe('Identity & KYC Service — Administrator Suite', () => {
  let adminToken;
  let adminUserId;
  let userToken;
  let testUserId;
  let testKycId;

  beforeEach(async () => {
    // 1. Create Admin
    const adminHash = await bcrypt.hash('AdminPassword123!', 10);
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@agrirent.internal',
      phone: '+919000000001',
      passwordHash: adminHash,
      roles: ['USER', 'ADMIN'],
      accountStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
    });
    adminUserId = adminUser.userId;

    const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: 'admin@agrirent.internal',
      password: 'AdminPassword123!',
    });
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Create Normal User
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Test Farmer',
      email: 'farmer@example.com',
      phone: '+919876511111',
      password: 'FarmerPass123!',
    });
    testUserId = regRes.body.data.userId;

    const userLoginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: 'farmer@example.com',
      password: 'FarmerPass123!',
    });
    userToken = userLoginRes.body.data.accessToken;

    // 3. User submits KYC
    const kycRes = await request(app)
      .post('/api/v1/kyc/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        documentType: 'PAN',
        documentReference: 'storage://pan-farmer-123.pdf',
      });
    testKycId = kycRes.body.data.kycId;
  });

  describe('KYC Review & Verification', () => {
    it('should allow admin to list pending KYC submissions', async () => {
      const res = await request(app)
        .get('/api/v1/kyc/admin/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].kycId).toBe(testKycId);
    });

    it('should reject normal user attempting to access admin pending list (403)', async () => {
      const res = await request(app)
        .get('/api/v1/kyc/admin/pending')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated request to admin pending list (401)', async () => {
      const res = await request(app).get('/api/v1/kyc/admin/pending');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should allow admin to approve KYC, transition status to VERIFIED, and remove from pending queue', async () => {
      const res = await request(app)
        .patch(`/api/v1/kyc/admin/${testKycId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decisionNote: 'Verified original PAN card' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VERIFIED');
      expect(res.body.data.reviewedBy).toBe(adminUserId);

      // Verify User in DB is updated to VERIFIED
      const updatedUser = await User.findOne({ userId: testUserId });
      expect(updatedUser.kycStatus).toBe('VERIFIED');

      // Verify pending-list endpoint no longer returns this approved submission
      const pendingRes = await request(app)
        .get('/api/v1/kyc/admin/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pendingRes.status).toBe(200);
      expect(pendingRes.body.data.find((s) => s.kycId === testKycId)).toBeUndefined();

      // Verify Audit log
      const audit = await AuditLog.findOne({ action: 'KYC_APPROVED' });
      expect(audit).toBeDefined();
      expect(audit.actorUserId).toBe(adminUserId);
      expect(audit.targetUserId).toBe(testUserId);
    });

    it('should allow admin to reject KYC with required reason and remove from pending queue', async () => {
      const res = await request(app)
        .patch(`/api/v1/kyc/admin/${testKycId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'PAN image is blurry and illegible' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('PAN image is blurry and illegible');

      const updatedUser = await User.findOne({ userId: testUserId });
      expect(updatedUser.kycStatus).toBe('REJECTED');

      // Verify pending-list endpoint no longer returns this rejected submission
      const pendingRes = await request(app)
        .get('/api/v1/kyc/admin/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pendingRes.status).toBe(200);
      expect(pendingRes.body.data.find((s) => s.kycId === testKycId)).toBeUndefined();
    });

    it('should return 404 and not report false success when approving nonexistent kycId', async () => {
      const res = await request(app)
        .patch('/api/v1/kyc/admin/KYC-NONEXISTENT/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decisionNote: 'Testing failure' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KYC_NOT_FOUND');
    });

    it('should reject KYC rejection without a reason (422)', async () => {
      const res = await request(app)
        .patch(`/api/v1/kyc/admin/${testKycId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should prevent admin from approving their own KYC submission (403 Self-Verification Guard)', async () => {
      // Admin submits their own KYC
      const adminKyc = await request(app)
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          documentType: 'PASSPORT',
          documentReference: 'storage://admin-passport.pdf',
        });

      // Admin attempts to approve their own KYC
      const res = await request(app)
        .patch(`/api/v1/kyc/admin/${adminKyc.body.data.kycId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('User Account Status Management', () => {
    it('should allow admin to suspend user account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Investigation of reported dispute' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('SUSPENDED');

      const inDb = await User.findOne({ userId: testUserId });
      expect(inDb.accountStatus).toBe('SUSPENDED');
    });

    it('should allow admin to block user account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testUserId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Severe terms of service breach' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('BLOCKED');
    });

    it('should allow admin to restore suspended/blocked user account to ACTIVE', async () => {
      await User.updateOne({ userId: testUserId }, { accountStatus: 'SUSPENDED' });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${testUserId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('ACTIVE');
    });
  });
});
