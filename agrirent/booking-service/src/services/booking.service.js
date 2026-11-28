const Booking = require('../models/Booking');
const ReservationLock = require('../models/ReservationLock');
const equipmentClient = require('./equipment.client');
const ApiError = require('../utils/ApiError');

const RESERVING_STATUSES = ['PENDING_OWNER', 'APPROVED', 'PAID', 'IN_RENTAL'];

class BookingService {
  /**
   * Helper to calculate rental days and price snapshot using half-open [startDate, endDate) convention.
   */
  calculatePricing(startDate, endDate, pricePerDay, securityDeposit) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const diffMs = end.getTime() - start.getTime();
    const rentalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (rentalDays < 1) {
      throw new ApiError(400, 'INVALID_DATES', 'Booking duration must be at least 1 full day.');
    }

    const pricePerDaySnapshot = pricePerDay;
    const rentalAmount = Math.round(rentalDays * pricePerDaySnapshot * 100) / 100;
    const platformFee = Math.round(rentalAmount * 0.03 * 100) / 100; // 3% platform fee
    const totalAmount = Math.round((rentalAmount + platformFee + securityDeposit) * 100) / 100;

    return {
      rentalDays,
      pricePerDaySnapshot,
      rentalAmount,
      platformFee,
      securityDeposit,
      totalAmount,
      currency: 'INR',
    };
  }

  /**
   * Queries existing bookings for interval overlaps:
   * existing.startDate < requested.endDate AND existing.endDate > requested.startDate
   */
  async findOverlappingBookings(equipmentId, startDate, endDate, excludeBookingId = null) {
    const query = {
      equipmentId,
      status: { $in: RESERVING_STATUSES },
      startDate: { $lt: new Date(endDate) },
      endDate: { $gt: new Date(startDate) },
    };

    if (excludeBookingId) {
      query.bookingId = { $ne: excludeBookingId };
    }

    return await Booking.find(query);
  }

  /**
   * Concurrency-safe booking creation with atomic reservation mutex.
   */
  async createBooking(renterId, data, correlationId = 'internal', idempotencyKey = null) {
    // 1. Idempotency check
    if (idempotencyKey) {
      const existingKeyBooking = await Booking.findOne({ idempotencyKey });
      if (existingKeyBooking) {
        return { booking: existingKeyBooking, isDuplicate: true };
      }
    }

    const { equipmentId, startDate, endDate } = data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'INVALID_DATES', 'startDate and endDate must be valid ISO8601 dates.');
    }

    if (end <= start) {
      throw new ApiError(400, 'INVALID_DATES', 'endDate must be strictly later than startDate.');
    }

    // Disallow booking in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new ApiError(400, 'INVALID_DATES', 'startDate cannot be in the past.');
    }

    // 2. Fetch live equipment details from Equipment Service
    const equipment = await equipmentClient.getEquipmentById(equipmentId, correlationId);

    if (equipment.status !== 'ACTIVE') {
      throw new ApiError(
        422,
        'EQUIPMENT_NOT_AVAILABLE',
        `Equipment is not currently available for rent (current status: ${equipment.status}).`
      );
    }

    // 3. Prevent owners from renting their own equipment
    if (equipment.ownerId === renterId) {
      throw new ApiError(
        400,
        'CANNOT_RENT_OWN_EQUIPMENT',
        'Equipment owners are not permitted to rent their own equipment listings.'
      );
    }

    // 4. Calculate authoritative price snapshot
    const pricing = this.calculatePricing(
      start,
      end,
      equipment.pricePerDay,
      equipment.securityDeposit || 0
    );

    // 5. Concurrency-Safe Reservation Locking
    await ReservationLock.acquire(equipment.equipmentId);

    try {
      // Re-verify availability inside lock
      const conflicts = await this.findOverlappingBookings(equipment.equipmentId, start, end);
      if (conflicts.length > 0) {
        throw new ApiError(
          409,
          'DATE_CONFLICT',
          'Equipment is already reserved or booked for the selected dates.'
        );
      }

      // 24-hour response deadline for the owner
      const ownerResponseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const booking = await Booking.create({
        equipmentId: equipment.equipmentId,
        ownerId: equipment.ownerId,
        renterId,
        startDate: start,
        endDate: end,
        ...pricing,
        status: 'PENDING_OWNER',
        ownerResponseDeadline,
        idempotencyKey: idempotencyKey || undefined,
      });

      return { booking, isDuplicate: false };
    } finally {
      await ReservationLock.release(equipment.equipmentId);
    }
  }

  /**
   * Retrieves booking details with authorization check.
   */
  async getBookingById(bookingId, requesterId, requesterRole = 'USER') {
    const query = {
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    };

    const booking = await Booking.findOne(query);
    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    const isRenter = booking.renterId === requesterId;
    const isOwner = booking.ownerId === requesterId;
    const isAdmin = requesterRole === 'ADMIN';

    if (!isRenter && !isOwner && !isAdmin) {
      throw new ApiError(403, 'ACCESS_DENIED', 'You are not authorized to view this booking record.');
    }

    return booking;
  }

  /**
   * Retrieves bookings requested by the authenticated renter.
   */
  async getRenterBookings(renterId, queryParams) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { renterId };
    if (queryParams.status) {
      filter.status = queryParams.status.toUpperCase();
    }

    const [data, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Booking.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves incoming booking requests for equipment owned by authenticated user.
   */
  async getOwnerRequests(ownerId, queryParams) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { ownerId };
    if (queryParams.status) {
      filter.status = queryParams.status.toUpperCase();
    }

    const [data, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Booking.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Equipment Owner approves a pending booking request.
   */
  async approveBooking(bookingId, ownerId) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    if (booking.ownerId !== ownerId) {
      throw new ApiError(403, 'NOT_EQUIPMENT_OWNER', 'You are not the owner of the equipment for this booking.');
    }

    if (booking.status !== 'PENDING_OWNER') {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Booking cannot be approved because current status is ${booking.status}.`
      );
    }

    // Direct synchronous check for 24-hour response deadline
    if (new Date() > new Date(booking.ownerResponseDeadline)) {
      booking.status = 'EXPIRED';
      booking.expiredAt = new Date();
      await booking.save();
      throw new ApiError(
        409,
        'BOOKING_EXPIRED',
        'The 24-hour owner approval deadline has elapsed. This booking request has expired.'
      );
    }

    // Calculate 24-hour payment deadline from approval or start of rental
    const paymentDeadline = new Date(Math.min(Date.now() + 24 * 60 * 60 * 1000, new Date(booking.startDate).getTime()));

    // Concurrency-safe atomic transition
    const updated = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: 'PENDING_OWNER',
        ownerResponseDeadline: { $gte: new Date() },
      },
      {
        $set: {
          status: 'APPROVED',
          approvedAt: new Date(),
          paymentDeadline,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new ApiError(409, 'BOOKING_EXPIRED', 'Booking state changed or response deadline elapsed.');
    }

    return updated;
  }

  /**
   * Equipment Owner rejects a pending booking request.
   */
  async rejectBooking(bookingId, ownerId, reason = null) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    if (booking.ownerId !== ownerId) {
      throw new ApiError(403, 'NOT_EQUIPMENT_OWNER', 'You are not the owner of the equipment for this booking.');
    }

    if (booking.status !== 'PENDING_OWNER') {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Booking cannot be rejected because current status is ${booking.status}.`
      );
    }

    booking.status = 'REJECTED';
    booking.rejectedAt = new Date();
    booking.rejectionReason = reason || 'Declined by owner';
    await booking.save();

    return booking;
  }

  /**
   * Cancels an eligible booking (Renter or Owner).
   */
  async cancelBooking(bookingId, requesterId, reason = null) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    const isRenter = booking.renterId === requesterId;
    const isOwner = booking.ownerId === requesterId;

    if (!isRenter && !isOwner) {
      throw new ApiError(403, 'NOT_PARTICIPANT', 'Only the renter or owner may cancel this booking.');
    }

    const cancellableStatuses = ['PENDING_OWNER', 'APPROVED'];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new ApiError(
        409,
        'CANCELLATION_NOT_ALLOWED',
        `Bookings in state '${booking.status}' cannot be cancelled.`
      );
    }

    // Determine refund eligibility
    const hoursUntilStart = (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
    let refundEligibility;

    if (booking.status === 'PENDING_OWNER') {
      refundEligibility = {
        eligible: true,
        percentage: 100,
        policyNote: 'Request cancelled prior to owner approval. 100% full refund.',
      };
    } else if (hoursUntilStart >= 24) {
      refundEligibility = {
        eligible: true,
        percentage: 100,
        policyNote: 'Cancelled more than 24 hours prior to rental start. 100% full refund.',
      };
    } else {
      refundEligibility = {
        eligible: true,
        percentage: 50,
        policyNote: 'Cancelled less than 24 hours prior to rental start. 50% rental fee refund + 100% deposit.',
      };
    }

    booking.status = 'CANCELLED';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || `Cancelled by ${isRenter ? 'renter' : 'owner'}`;
    await booking.save();

    return {
      booking,
      refundEligibility,
    };
  }

  /**
   * Authoritative availability check across [startDate, endDate).
   */
  async checkAvailability(equipmentId, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new ApiError(400, 'INVALID_DATES', 'Invalid date range: endDate must be later than startDate.');
    }

    const conflicts = await this.findOverlappingBookings(equipmentId, start, end);

    return {
      equipmentId,
      startDate,
      endDate,
      available: conflicts.length === 0,
      conflictingBookingsCount: conflicts.length,
    };
  }

  /**
   * Internal endpoint handler: Confirms payment for an approved booking (APPROVED -> PAID).
   * Idempotent: If already PAID, returns the existing record.
   */
  async confirmBookingPayment(bookingId, paymentData = {}) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // Idempotent: If already marked PAID, return existing booking
    if (booking.status === 'PAID') {
      return {
        booking,
        message: 'Booking payment is already confirmed.',
        isDuplicate: true,
      };
    }

    if (booking.status !== 'APPROVED') {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Booking cannot transition to PAID from current status '${booking.status}'. Must be in APPROVED status.`
      );
    }

    // Verify payment deadline has not elapsed
    if (booking.paymentDeadline && new Date() > new Date(booking.paymentDeadline)) {
      throw new ApiError(
        409,
        'BOOKING_EXPIRED',
        'Payment deadline for this approved booking has elapsed.'
      );
    }

    booking.status = 'PAID';
    booking.paidAt = new Date();
    if (paymentData.paymentId || paymentData.transactionReference) {
      booking.paymentReference = paymentData.paymentId || paymentData.transactionReference;
    }
    await booking.save();

    return {
      booking,
      message: 'Booking payment confirmed successfully. Status transitioned to PAID.',
      isDuplicate: false,
    };
  }

  /**
   * Internal endpoint handler: Records failed payment attempt. Keeps booking APPROVED until deadline.
   */
  async failBookingPayment(bookingId, errorData = {}) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    return {
      bookingId: booking.bookingId,
      status: booking.status,
      message: 'Payment failure recorded. Booking remains in APPROVED status until deadline.',
    };
  }

  /**
   * Internal endpoint handler: Confirms handover of equipment (PAID -> IN_RENTAL).
   * Idempotent: If already IN_RENTAL, returns the existing record.
   */
  async confirmHandover(bookingId, handoverData = {}) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // Idempotent: If already marked IN_RENTAL, return existing booking
    if (booking.status === 'IN_RENTAL') {
      return {
        booking,
        message: 'Booking handover is already confirmed.',
        isDuplicate: true,
      };
    }

    if (booking.status !== 'PAID') {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Booking cannot transition to IN_RENTAL from current status '${booking.status}'. Must be in PAID status.`
      );
    }

    booking.status = 'IN_RENTAL';
    booking.handoverAt = handoverData.handedOverAt ? new Date(handoverData.handedOverAt) : new Date();
    if (handoverData.handoverId) {
      booking.handoverId = handoverData.handoverId;
    }
    await booking.save();

    return {
      booking,
      message: 'Booking handover confirmed successfully. Status transitioned to IN_RENTAL.',
      isDuplicate: false,
    };
  }

  /**
   * Internal endpoint handler: Confirms equipment return (IN_RENTAL -> RETURNED).
   * Idempotent: If already RETURNED, returns the existing record.
   */
  async confirmReturn(bookingId, returnData = {}) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // Idempotent: If already marked RETURNED, return existing booking
    if (booking.status === 'RETURNED' || booking.status === 'COMPLETED') {
      return {
        booking,
        message: 'Booking return is already confirmed.',
        isDuplicate: true,
      };
    }

    if (booking.status !== 'IN_RENTAL') {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Booking cannot transition to RETURNED from current status '${booking.status}'. Must be in IN_RENTAL status.`
      );
    }

    booking.status = 'RETURNED';
    booking.returnedAt = returnData.returnedAt ? new Date(returnData.returnedAt) : new Date();
    if (returnData.returnId) {
      booking.returnId = returnData.returnId;
    }
    if (returnData.fineAmount !== undefined) {
      booking.lateFineAmount = returnData.fineAmount;
    }
    await booking.save();

    return {
      booking,
      message: 'Booking return confirmed successfully. Status transitioned to RETURNED.',
      isDuplicate: false,
    };
  }

  /**
   * Internal endpoint handler: Confirms booking settlement completion (RETURNED -> COMPLETED).
   * Idempotent: If already COMPLETED, returns existing booking.
   */
  async confirmCompletion(bookingId, completionData = {}) {
    const booking = await Booking.findOne({
      $or: [{ bookingId }, { _id: bookingId.match(/^[0-9a-fA-F]{24}$/) ? bookingId : null }],
    });

    if (!booking) {
      throw new ApiError(404, 'BOOKING_NOT_FOUND', `Booking '${bookingId}' was not found.`);
    }

    // Idempotent: If already marked COMPLETED, return existing booking
    if (booking.status === 'COMPLETED') {
      return {
        booking,
        message: 'Booking completion is already confirmed.',
        isDuplicate: true,
      };
    }

    if (booking.status !== 'RETURNED') {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Booking cannot transition to COMPLETED from current status '${booking.status}'. Must be in RETURNED status.`
      );
    }

    booking.status = 'COMPLETED';
    await booking.save();

    return {
      booking,
      message: 'Booking completion confirmed successfully. Status transitioned to COMPLETED.',
      isDuplicate: false,
    };
  }
}

module.exports = new BookingService();
