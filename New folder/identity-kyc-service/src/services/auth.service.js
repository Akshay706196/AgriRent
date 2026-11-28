const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const { normalizeEmail, normalizePhone } = require('../utils/normalize');
const { generateAccessToken } = require('../utils/token');

class AuthService {
  /**
   * Registers a new user.
   */
  async register({ name, email, phone, password }, correlationId = 'internal') {
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = normalizePhone(phone);

    // 1. Uniqueness check for email and phone
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      throw new ApiError(409, 'USER_EXISTS', 'An account with this email address already exists.');
    }

    const existingPhone = await User.findOne({ phone: cleanPhone });
    if (existingPhone) {
      throw new ApiError(409, 'USER_EXISTS', 'An account with this phone number already exists.');
    }

    // 2. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Create user record
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      accountStatus: 'ACTIVE',
      kycStatus: 'NOT_SUBMITTED',
      roles: ['USER'],
    });

    // 4. Security Audit Log
    await AuditLog.create({
      actorUserId: user.userId,
      action: 'USER_REGISTERED',
      targetUserId: user.userId,
      correlationId,
      metadata: { email: cleanEmail, phone: cleanPhone },
    });

    return user.toSafeObject();
  }

  /**
   * Authenticates user using email or phone and password.
   */
  async login({ identifier, password }, correlationId = 'internal') {
    const rawId = (identifier || '').trim();
    const isEmail = rawId.includes('@');
    const query = isEmail
      ? { email: normalizeEmail(rawId) }
      : { phone: normalizePhone(rawId) };

    const user = await User.findOne(query).select('+passwordHash');
    if (!user) {
      await AuditLog.create({
        actorUserId: 'anonymous',
        action: 'LOGIN_FAILED',
        correlationId,
        metadata: { identifier: rawId, reason: 'USER_NOT_FOUND' },
      });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password.');
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await AuditLog.create({
        actorUserId: user.userId,
        action: 'LOGIN_FAILED',
        correlationId,
        metadata: { reason: 'PASSWORD_MISMATCH' },
      });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password.');
    }

    // Verify account status
    if (user.accountStatus === 'BLOCKED') {
      throw new ApiError(403, 'ACCOUNT_BLOCKED', 'This account has been blocked due to policy violations.');
    }
    if (user.accountStatus === 'SUSPENDED') {
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account is currently suspended pending administrative review.');
    }
    if (user.accountStatus === 'DEACTIVATED') {
      throw new ApiError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated.');
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Issue JWT
    const tokenData = generateAccessToken(user);

    await AuditLog.create({
      actorUserId: user.userId,
      action: 'LOGIN_SUCCESS',
      correlationId,
    });

    return {
      ...tokenData,
      user: user.toSafeObject(),
    };
  }

  /**
   * Allows user to change password securely.
   */
  async changePassword(userId, currentPassword, newPassword, correlationId = 'internal') {
    const user = await User.findOne({ userId }).select('+passwordHash');
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User record not found.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new ApiError(400, 'INVALID_INPUT', 'Current password is incorrect.');
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    await AuditLog.create({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      targetUserId: userId,
      correlationId,
    });

    return { message: 'Password updated successfully.' };
  }
}

module.exports = new AuthService();
