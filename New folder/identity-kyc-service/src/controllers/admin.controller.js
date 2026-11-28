const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/admin.service');

const getUserAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await adminService.getUserDetails(userId);
  res.status(200).json({
    success: true,
    data: result,
  });
});

const suspendAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminUserId = req.user.userId;
  const { reason } = req.body;

  const result = await adminService.suspendUser(
    userId,
    adminUserId,
    reason,
    req.correlationId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

const blockAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminUserId = req.user.userId;
  const { reason } = req.body;

  const result = await adminService.blockUser(
    userId,
    adminUserId,
    reason,
    req.correlationId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

const restoreAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminUserId = req.user.userId;

  const result = await adminService.restoreUser(
    userId,
    adminUserId,
    req.correlationId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getUserAccount,
  suspendAccount,
  blockAccount,
  restoreAccount,
};
