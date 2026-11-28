const KYCSubmission = require('../models/KYCSubmission');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');

class KYCService {
  /**
   * Submits identity documents for verification.
   */
  async submitKyc(userId, { documentType, documentReference }, correlationId = 'internal') {
    console.log(`[KYC Service] [${correlationId}] KYC submission received for user ${userId}, type: ${documentType}`);

    // 1. Check for duplicate active submission
    const activeSubmission = await KYCSubmission.findOne({
      userId,
      status: { $in: ['PENDING', 'UNDER_REVIEW'] },
    });

    if (activeSubmission) {
      throw new ApiError(
        409,
        'KYC_ALREADY_PENDING',
        'An active KYC submission is already pending administrative review.'
      );
    }

    // 2. Determine submission version
    const previousCount = await KYCSubmission.countDocuments({ userId });
    const version = previousCount + 1;

    // 3. Mark previous submissions as not current
    await KYCSubmission.updateMany({ userId }, { $set: { isCurrent: false } });

    // 4. Create new submission record
    const submission = await KYCSubmission.create({
      userId,
      documentType: documentType.toUpperCase(),
      documentReference,
      status: 'PENDING',
      version,
      isCurrent: true,
      submittedAt: new Date(),
    });

    // 5. Update user summary status to PENDING
    await User.updateOne({ userId }, { $set: { kycStatus: 'PENDING' } });

    // 6. Security Audit Log
    await AuditLog.create({
      actorUserId: userId,
      action: 'KYC_SUBMITTED',
      targetUserId: userId,
      targetKycId: submission.kycId,
      correlationId,
      metadata: { documentType, version },
    });

    console.log(`[KYC Service] [${correlationId}] KYC submission persisted: ${submission.kycId} (status: ${submission.status})`);

    return {
      kycId: submission.kycId,
      status: submission.status,
      submittedAt: submission.submittedAt,
      version: submission.version,
    };
  }

  /**
   * Retrieves own latest KYC status.
   */
  async getOwnKycStatus(userId) {
    const [user, latestSubmission] = await Promise.all([
      User.findOne({ userId }),
      KYCSubmission.findOne({ userId, isCurrent: true }),
    ]);

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    return {
      kycStatus: user.kycStatus,
      latestSubmission: latestSubmission
        ? {
            kycId: latestSubmission.kycId,
            documentType: latestSubmission.documentType,
            status: latestSubmission.status,
            submittedAt: latestSubmission.submittedAt,
            reviewedAt: latestSubmission.reviewedAt,
            rejectionReason: latestSubmission.rejectionReason,
            version: latestSubmission.version,
          }
        : null,
    };
  }

  /**
   * Retrieves own KYC submission history.
   */
  async getOwnKycHistory(userId, queryParams) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      KYCSubmission.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-documentReference'), // Do not leak raw storage references in list
      KYCSubmission.countDocuments({ userId }),
    ]);

    return {
      data: submissions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Lists pending KYC submissions (Admin only).
   */
  async listPendingSubmissions(queryParams) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      status: { $in: ['PENDING', 'UNDER_REVIEW'] },
    };

    console.log(`[KYC Service] Pending submissions query started (page: ${page}, limit: ${limit})`);

    const [submissions, total] = await Promise.all([
      KYCSubmission.find(filter)
        .sort({ submittedAt: 1 })
        .skip(skip)
        .limit(limit),
      KYCSubmission.countDocuments(filter),
    ]);

    console.log(`[KYC Service] Pending submissions query completed: ${submissions.length} records found (total: ${total})`);

    return {
      data: submissions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves submission details for review (Admin only).
   */
  async getSubmissionById(kycId) {
    const submission = await KYCSubmission.findOne({ kycId });
    if (!submission) {
      throw new ApiError(404, 'KYC_NOT_FOUND', `KYC submission '${kycId}' was not found.`);
    }

    const user = await User.findOne({ userId: submission.userId });

    return {
      submission,
      user: user ? user.toSafeObject() : null,
    };
  }

  /**
   * Admin approves a KYC submission.
   */
  async approveKyc(kycId, adminUserId, decisionNote = null, correlationId = 'internal') {
    const submission = await KYCSubmission.findOne({ kycId });
    if (!submission) {
      throw new ApiError(404, 'KYC_NOT_FOUND', `KYC submission '${kycId}' was not found.`);
    }

    if (submission.status !== 'PENDING' && submission.status !== 'UNDER_REVIEW') {
      throw new ApiError(
        409,
        'INVALID_KYC_TRANSITION',
        `Submission cannot be approved because current status is ${submission.status}.`
      );
    }

    // Self-verification prevention
    if (submission.userId === adminUserId) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Administrators are not permitted to approve their own KYC verification submission.'
      );
    }

    submission.status = 'VERIFIED';
    submission.reviewedAt = new Date();
    submission.reviewedBy = adminUserId;
    submission.decisionNote = decisionNote || 'Identity documents verified by administrator.';
    await submission.save();

    // Update User summary status to VERIFIED
    await User.updateOne({ userId: submission.userId }, { $set: { kycStatus: 'VERIFIED' } });

    // Security Audit Log
    await AuditLog.create({
      actorUserId: adminUserId,
      action: 'KYC_APPROVED',
      targetUserId: submission.userId,
      targetKycId: submission.kycId,
      correlationId,
      metadata: { decisionNote },
    });

    console.log(`[KYC Service] [${correlationId}] KYC approval persisted: ${submission.kycId} for user ${submission.userId} by admin ${adminUserId}`);

    return {
      kycId: submission.kycId,
      userId: submission.userId,
      status: submission.status,
      reviewedAt: submission.reviewedAt,
      reviewedBy: submission.reviewedBy,
    };
  }

  /**
   * Admin rejects a KYC submission.
   */
  async rejectKyc(kycId, adminUserId, reason, correlationId = 'internal') {
    const submission = await KYCSubmission.findOne({ kycId });
    if (!submission) {
      throw new ApiError(404, 'KYC_NOT_FOUND', `KYC submission '${kycId}' was not found.`);
    }

    if (submission.status !== 'PENDING' && submission.status !== 'UNDER_REVIEW') {
      throw new ApiError(
        409,
        'INVALID_KYC_TRANSITION',
        `Submission cannot be rejected because current status is ${submission.status}.`
      );
    }

    submission.status = 'REJECTED';
    submission.reviewedAt = new Date();
    submission.reviewedBy = adminUserId;
    submission.rejectionReason = reason;
    await submission.save();

    // Update User summary status to REJECTED
    await User.updateOne({ userId: submission.userId }, { $set: { kycStatus: 'REJECTED' } });

    // Security Audit Log
    await AuditLog.create({
      actorUserId: adminUserId,
      action: 'KYC_REJECTED',
      targetUserId: submission.userId,
      targetKycId: submission.kycId,
      correlationId,
      metadata: { reason },
    });

    console.log(`[KYC Service] [${correlationId}] KYC rejection persisted: ${submission.kycId} for user ${submission.userId} by admin ${adminUserId}`);

    return {
      kycId: submission.kycId,
      userId: submission.userId,
      status: submission.status,
      reviewedAt: submission.reviewedAt,
      reviewedBy: submission.reviewedBy,
      rejectionReason: submission.rejectionReason,
    };
  }
}

module.exports = new KYCService();
