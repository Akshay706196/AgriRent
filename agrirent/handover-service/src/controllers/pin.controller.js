const asyncHandler = require('../utils/asyncHandler');
const pinService = require('../services/pin.service');

const generateHandoverPin = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const correlationId = req.correlationId;

  const result = await pinService.generatePinForBooking({
    bookingId,
    type: 'HANDOVER',
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

const generateReturnPin = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const correlationId = req.correlationId;

  const result = await pinService.generatePinForBooking({
    bookingId,
    type: 'RETURN',
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

module.exports = {
  generateHandoverPin,
  generateReturnPin,
};
