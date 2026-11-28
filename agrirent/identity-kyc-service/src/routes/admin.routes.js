const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { validateSuspendUser, validateBlockUser } = require('../validators/admin.validator');

// All routes here strictly require authentication and ADMIN role
router.use(requireAuth, requireAdmin);

// View user account details
router.get('/users/:userId', adminController.getUserAccount);

// Suspend user account
router.patch('/users/:userId/suspend', validateSuspendUser, adminController.suspendAccount);

// Block user account
router.patch('/users/:userId/block', validateBlockUser, adminController.blockAccount);

// Restore user account to ACTIVE
router.patch('/users/:userId/restore', adminController.restoreAccount);

module.exports = router;
