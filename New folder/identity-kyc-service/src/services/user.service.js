const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const { normalizePhone } = require('../utils/normalize');

class UserService {
  /**
   * Retrieves profile by userId.
   */
  async getProfile(userId) {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User '${userId}' not found.`);
    }
    return user.toSafeObject();
  }

  /**
   * Updates permitted profile fields (name, phone).
   */
  async updateProfile(userId, updateData, correlationId = 'internal') {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User '${userId}' not found.`);
    }

    if (updateData.name) {
      user.name = updateData.name.trim();
    }

    if (updateData.phone) {
      const cleanPhone = normalizePhone(updateData.phone);
      if (cleanPhone !== user.phone) {
        const existingPhone = await User.findOne({ phone: cleanPhone, userId: { $ne: userId } });
        if (existingPhone) {
          throw new ApiError(409, 'USER_EXISTS', 'This phone number is already registered to another account.');
        }
        user.phone = cleanPhone;
      }
    }

    await user.save();

    await AuditLog.create({
      actorUserId: userId,
      action: 'PROFILE_UPDATED',
      targetUserId: userId,
      correlationId,
    });

    return user.toSafeObject();
  }

  /**
   * Returns user eligibility assertion for Equipment and Booking services.
   */
  async getUserEligibility(userId) {
    const user = await User.findOne({ userId });
    if (!user) {
      return {
        userId,
        exists: false,
        accountStatus: null,
        kycStatus: null,
        canRent: false,
        canListEquipment: false,
      };
    }

    const isActive = user.accountStatus === 'ACTIVE';
    const isVerified = user.kycStatus === 'VERIFIED';
    const eligible = isActive && isVerified;

    return {
      userId: user.userId,
      exists: true,
      accountStatus: user.accountStatus,
      kycStatus: user.kycStatus,
      canRent: eligible,
      canListEquipment: eligible,
    };
  }
}

module.exports = new UserService();
