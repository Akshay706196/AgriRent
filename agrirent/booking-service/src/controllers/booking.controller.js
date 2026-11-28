const asyncHandler = require('../utils/asyncHandler');
const bookingService = require('../services/booking.service');

const createBooking = asyncHandler(async (req, res) => {
  const renterId = req.user.id;
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

  const { booking, isDuplicate } = await bookingService.createBooking(
    renterId,
    req.body,
    req.correlationId,
    idempotencyKey
  );

  res.status(isDuplicate ? 200 : 201).json(booking);
});

const getBookingById = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const requesterId = req.user.id;
  const requesterRole = req.user.role;

  const booking = await bookingService.getBookingById(bookingId, requesterId, requesterRole);
  res.status(200).json(booking);
});

const getMyBookings = asyncHandler(async (req, res) => {
  const renterId = req.user.id;
  const result = await bookingService.getRenterBookings(renterId, req.query);
  res.status(200).json(result);
});

const getOwnerRequests = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const result = await bookingService.getOwnerRequests(ownerId, req.query);
  res.status(200).json(result);
});

const approveBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const ownerId = req.user.id;

  const approved = await bookingService.approveBooking(bookingId, ownerId);
  res.status(200).json(approved);
});

const rejectBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const ownerId = req.user.id;
  const { reason } = req.body;

  const rejected = await bookingService.rejectBooking(bookingId, ownerId, reason);
  res.status(200).json(rejected);
});

const cancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const requesterId = req.user.id;
  const { reason } = req.body;

  const result = await bookingService.cancelBooking(bookingId, requesterId, reason);
  res.status(200).json(result);
});

const checkAvailability = asyncHandler(async (req, res) => {
  const { equipmentId, startDate, endDate } = req.query;
  const result = await bookingService.checkAvailability(equipmentId, startDate, endDate);
  res.status(200).json(result);
});

const confirmPayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await bookingService.confirmBookingPayment(bookingId, req.body);
  res.status(200).json(result);
});

const failPayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await bookingService.failBookingPayment(bookingId, req.body);
  res.status(200).json(result);
});

const confirmHandover = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await bookingService.confirmHandover(bookingId, req.body);
  res.status(200).json(result);
});

const confirmReturn = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await bookingService.confirmReturn(bookingId, req.body);
  res.status(200).json(result);
});

const confirmCompletion = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const result = await bookingService.confirmCompletion(bookingId, req.body);
  res.status(200).json(result);
});

module.exports = {
  createBooking,
  getBookingById,
  getMyBookings,
  getOwnerRequests,
  approveBooking,
  rejectBooking,
  cancelBooking,
  checkAvailability,
  confirmPayment,
  failPayment,
  confirmHandover,
  confirmReturn,
  confirmCompletion,
};
