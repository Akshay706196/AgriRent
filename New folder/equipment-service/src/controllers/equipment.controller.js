const asyncHandler = require('../utils/asyncHandler');
const equipmentService = require('../services/equipment.service');

const createEquipment = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const equipment = await equipmentService.createEquipment(ownerId, req.body);
  res.status(201).json(equipment);
});

const getEquipmentById = asyncHandler(async (req, res) => {
  const { equipmentId } = req.params;
  const equipment = await equipmentService.getEquipmentById(equipmentId);
  res.status(200).json(equipment);
});

const updateEquipment = asyncHandler(async (req, res) => {
  const { equipmentId } = req.params;
  const requesterId = req.user.id;
  const updated = await equipmentService.updateEquipment(equipmentId, requesterId, req.body);
  res.status(200).json(updated);
});

const deleteEquipment = asyncHandler(async (req, res) => {
  const { equipmentId } = req.params;
  const requesterId = req.user.id;
  const result = await equipmentService.deleteEquipment(equipmentId, requesterId, req.correlationId);
  res.status(200).json(result);
});

const searchEquipment = asyncHandler(async (req, res) => {
  const results = await equipmentService.searchEquipment(req.query);
  res.status(200).json(results);
});

const getMyEquipment = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const results = await equipmentService.getMyEquipment(ownerId, req.query);
  res.status(200).json(results);
});

const checkAvailability = asyncHandler(async (req, res) => {
  const { equipmentId } = req.params;
  const { startDate, endDate } = req.query;
  const availability = await equipmentService.checkAvailability(
    equipmentId,
    startDate,
    endDate,
    req.correlationId
  );
  res.status(200).json(availability);
});

module.exports = {
  createEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
  searchEquipment,
  getMyEquipment,
  checkAvailability,
};
