const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body, req.correlationId);
  res.status(201).json({
    success: true,
    data: user,
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req.correlationId);
  res.status(200).json({
    success: true,
    data: result,
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user.toSafeObject(),
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(
    req.user.userId,
    currentPassword,
    newPassword,
    req.correlationId
  );
  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  register,
  login,
  getCurrentUser,
  changePassword,
};
