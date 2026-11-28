const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { requireAuth, requireServiceAuth } = require('../middleware/auth.middleware');
const { validateUpdateProfile } = require('../validators/user.validator');

// Get own profile
router.get('/me', requireAuth, userController.getOwnProfile);

// Update own permitted profile fields
router.patch('/me', requireAuth, validateUpdateProfile, userController.updateOwnProfile);

// Service-to-service user eligibility assertion contract
router.get('/:userId/eligibility', requireServiceAuth, userController.getUserEligibility);

module.exports = router;
