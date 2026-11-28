const asyncHandler = require('../utils/asyncHandler');
const kycService = require('../services/kyc.service');

const submitKyc = asyncHandler(async (req, res) => {
  const result = await kycService.submitKyc(
    req.user.userId,
    req.body,
    req.correlationId
  );
  res.status(201).json({
    success: true,
    data: result,
  });
});

const getOwnKycStatus = asyncHandler(async (req, res) => {
  const result = await kycService.getOwnKycStatus(req.user.userId);
  res.status(200).json({
    success: true,
    data: result,
  });
});

const getOwnKycHistory = asyncHandler(async (req, res) => {
  const result = await kycService.getOwnKycHistory(req.user.userId, req.query);
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

const listPendingSubmissions = asyncHandler(async (req, res) => {
  const result = await kycService.listPendingSubmissions(req.query);
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

const getSubmissionById = asyncHandler(async (req, res) => {
  const { kycId } = req.params;
  const result = await kycService.getSubmissionById(kycId);
  res.status(200).json({
    success: true,
    data: result,
  });
});

const approveKyc = asyncHandler(async (req, res) => {
  const { kycId } = req.params;
  const adminUserId = req.user.userId;
  const { decisionNote } = req.body;

  const result = await kycService.approveKyc(
    kycId,
    adminUserId,
    decisionNote,
    req.correlationId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

const rejectKyc = asyncHandler(async (req, res) => {
  const { kycId } = req.params;
  const adminUserId = req.user.userId;
  const { reason } = req.body;

  const result = await kycService.rejectKyc(
    kycId,
    adminUserId,
    reason,
    req.correlationId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  submitKyc,
  getOwnKycStatus,
  getOwnKycHistory,
  listPendingSubmissions,
  getSubmissionById,
  approveKyc,
  rejectKyc,
};
