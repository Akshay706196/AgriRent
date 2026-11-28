const User = require('../models/User');
const KYCSubmission = require('../models/KYCSubmission');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');

class AdminService {
  /**
   * Retrieves administrative overview of a user account.
   */
  async getUserDetails(userId) {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User '${userId}' not found.`);
    }

    const [latestKyc, recentAuditLogs] = await Promise.all([
      KYCSubmission.findOne({ userId, isCurrent: true }),
      AuditLog.find({ targetUserId: userId }).sort({ timestamp: -1 }).limit(10),
    ]);

    return {
      user: user.toSafeObject(),
      latestKyc,
      recentAuditLogs,
    };
  }

  /**
   * Suspends a user account.
   */
  async suspendUser(userId, adminUserId, reason = null, correlationId = 'internal') {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User '${userId}' not found.`);
    }

    user.accountStatus = 'SUSPENDED';
    await user.save();

    await AuditLog.create({
      actorUserId: adminUserId,
      action: 'ACCOUNT_SUSPENDED',
      targetUserId: userId,
      correlationId,
      metadata: { reason },
    });

    return user.toSafeObject();
  }

  /**
   * Blocks a user account.
   */
  async blockUser(userId, adminUserId, reason = null, correlationId = 'internal') {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User '${userId}' not found.`);
    }

    user.accountStatus = 'BLOCKED';
    await user.save();

    await AuditLog.create({
      actorUserId: adminUserId,
      action: 'ACCOUNT_BLOCKED',
      targetUserId: userId,
      correlationId,
      metadata: { reason },
    });

    return user.toSafeObject();
  }

  /**
   * Restores a suspended or blocked account to ACTIVE.
   */
  async restoreUser(userId, adminUserId, correlationId = 'internal') {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User '${userId}' not found.`);
    }

    user.accountStatus = 'ACTIVE';
    await user.save();

    await AuditLog.create({
      actorUserId: adminUserId,
      action: 'ACCOUNT_RESTORED',
      targetUserId: userId,
      correlationId,
    });

    return user.toSafeObject();
  }
}

module.exports = new AdminService();
