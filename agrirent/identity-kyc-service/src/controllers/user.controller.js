const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');

const getOwnProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.userId);
  res.status(200).json({
    success: true,
    data: profile,
  });
});

const updateOwnProfile = asyncHandler(async (req, res) => {
  const updated = await userService.updateProfile(
    req.user.userId,
    req.body,
    req.correlationId
  );
  res.status(200).json({
    success: true,
    data: updated,
  });
});

const getUserEligibility = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const eligibility = await userService.getUserEligibility(userId);
  res.status(200).json({
    success: true,
    data: eligibility,
  });
});

module.exports = {
  getOwnProfile,
  updateOwnProfile,
  getUserEligibility,
};
