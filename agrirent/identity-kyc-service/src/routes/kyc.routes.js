const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { validateSubmitKyc, validateRejectKyc } = require('../validators/kyc.validator');

// Submit KYC documents (User)
router.post('/submit', requireAuth, validateSubmitKyc, kycController.submitKyc);

// Get own current KYC status (User)
router.get('/me', requireAuth, kycController.getOwnKycStatus);

// Get own submission history (User)
router.get('/me/history', requireAuth, kycController.getOwnKycHistory);

// List pending submissions (Admin only)
router.get('/admin/pending', requireAuth, requireAdmin, kycController.listPendingSubmissions);

// View specific submission details (Admin only)
router.get('/admin/:kycId', requireAuth, requireAdmin, kycController.getSubmissionById);

// Approve KYC submission (Admin only)
router.patch('/admin/:kycId/approve', requireAuth, requireAdmin, kycController.approveKyc);

// Reject KYC submission (Admin only)
router.patch('/admin/:kycId/reject', requireAuth, requireAdmin, validateRejectKyc, kycController.rejectKyc);

module.exports = router;
