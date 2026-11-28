const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { loginRateLimiter, registerRateLimiter } = require('../middleware/rateLimit.middleware');
const {
  validateRegister,
  validateLogin,
  validateChangePassword,
} = require('../validators/auth.validator');

// Register a new user
router.post('/register', registerRateLimiter, validateRegister, authController.register);

// Login and acquire access token
router.post('/login', loginRateLimiter, validateLogin, authController.login);

// Get authenticated user's own profile
router.get('/me', requireAuth, authController.getCurrentUser);

// Change password
router.patch('/change-password', requireAuth, validateChangePassword, authController.changePassword);

module.exports = router;
