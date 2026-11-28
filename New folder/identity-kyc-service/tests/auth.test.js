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

describe('Identity & KYC Service — Authentication Suite', () => {
  const validUser = {
    name: 'Ravi Kumar',
    email: 'ravi@example.com',
    phone: '+919876543210',
    password: 'ExampleStrongPassword123!',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully with safe profile and active status', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('userId');
      expect(res.body.data.name).toBe('Ravi Kumar');
      expect(res.body.data.email).toBe('ravi@example.com');
      expect(res.body.data.phone).toBe('+919876543210');
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(res.body.data.kycStatus).toBe('NOT_SUBMITTED');
      expect(res.body.data.roles).toEqual(['USER']);
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');

      // Verify in DB that password is encrypted
      const inDb = await User.findOne({ email: 'ravi@example.com' }).select('+passwordHash');
      expect(inDb.passwordHash).toBeDefined();
      expect(inDb.passwordHash).not.toBe(validUser.password);
    });

    it('should reject registration with duplicate email address (409)', async () => {
      await request(app).post('/api/v1/auth/register').send(validUser);

      const duplicate = { ...validUser, phone: '+919876543211' };
      const res = await request(app).post('/api/v1/auth/register').send(duplicate);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject registration with duplicate phone number (409)', async () => {
      await request(app).post('/api/v1/auth/register').send(validUser);

      const duplicate = { ...validUser, email: 'other@example.com' };
      const res = await request(app).post('/api/v1/auth/register').send(duplicate);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject invalid email or phone format (422)', async () => {
      const invalid = {
        name: 'Ravi',
        email: 'invalid-email',
        phone: '123',
        password: 'Pass',
      };
      const res = await request(app).post('/api/v1/auth/register').send(invalid);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should prevent client from self-assigning ADMIN role or setting accountStatus', async () => {
      const malicious = {
        ...validUser,
        roles: ['ADMIN'],
        accountStatus: 'SUSPENDED',
      };
      const res = await request(app).post('/api/v1/auth/register').send(malicious);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(validUser);
    });

    it('should authenticate user via email and issue signed JWT', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'ravi@example.com',
        password: validUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.tokenType).toBe('Bearer');
      expect(res.body.data.user.email).toBe('ravi@example.com');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should authenticate user via phone number and issue signed JWT', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: '+919876543210',
        password: validUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject invalid credentials with generic 401 error message', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'ravi@example.com',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email/phone or password.');
    });

    it('should reject login for suspended or blocked accounts (403)', async () => {
      await User.updateOne({ email: 'ravi@example.com' }, { accountStatus: 'SUSPENDED' });

      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'ravi@example.com',
        password: validUser.password,
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('GET /api/v1/auth/me & PATCH /api/v1/auth/change-password', () => {
    let token;

    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(validUser);
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: validUser.email,
        password: validUser.password,
      });
      token = loginRes.body.data.accessToken;
    });

    it('should retrieve own profile when authenticated with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(validUser.email);
    });

    it('should reject profile request with invalid or missing token (401)', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should allow user to change password and login with new password', async () => {
      const changeRes = await request(app)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: validUser.password,
          newPassword: 'BrandNewPassword789!',
        });

      expect(changeRes.status).toBe(200);

      // Verify login with new password works
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: validUser.email,
        password: 'BrandNewPassword789!',
      });
      expect(loginRes.status).toBe(200);
    });
  });
});
