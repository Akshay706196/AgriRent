const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipment.controller');
const { requireAuth, requireKyc } = require('../middleware/auth.middleware');
const {
  createEquipmentValidator,
  updateEquipmentValidator,
  availabilityQueryValidator,
} = require('../validators/equipment.validator');

// Create equipment (Owner must be authenticated and KYC verified)
router.post(
  '/',
  requireAuth,
  requireKyc,
  createEquipmentValidator,
  equipmentController.createEquipment
);

// Search equipment listings (Public)
router.get('/', equipmentController.searchEquipment);

// Get equipment listings owned by current authenticated farmer (Owner only)
router.get('/my-equipment', requireAuth, equipmentController.getMyEquipment);

// Check equipment availability for specific date range (Public)
router.get(
  '/:equipmentId/availability',
  availabilityQueryValidator,
  equipmentController.checkAvailability
);

// Get equipment details by equipmentId (Public)
router.get('/:equipmentId', equipmentController.getEquipmentById);

// Update equipment listing (Owner only)
router.patch(
  '/:equipmentId',
  requireAuth,
  updateEquipmentValidator,
  equipmentController.updateEquipment
);

// Soft delete / deactivate equipment listing (Owner only)
router.delete(
  '/:equipmentId',
  requireAuth,
  equipmentController.deleteEquipment
);

module.exports = router;
