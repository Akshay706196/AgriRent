const mongoose = require('mongoose');
const crypto = require('crypto');

const BookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: () => `BK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    },
    equipmentId: {
      type: String,
      required: [true, 'equipmentId is required'],
      index: true,
      trim: true,
    },
    ownerId: {
      type: String,
      required: [true, 'ownerId is required'],
      index: true,
      trim: true,
    },
    renterId: {
      type: String,
      required: [true, 'renterId is required'],
      index: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'startDate is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'endDate is required'],
      index: true,
    },
    rentalDays: {
      type: Number,
      required: true,
      min: [1, 'Rental duration must be at least 1 day'],
    },
    pricePerDaySnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    rentalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      min: 0,
    },
    securityDeposit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          'PENDING_OWNER',
          'APPROVED',
          'PAID',
          'REJECTED',
          'EXPIRED',
          'CANCELLED',
          'IN_RENTAL',
          'RETURNED',
          'COMPLETED',
        ],
        message: '{VALUE} is not a valid booking status',
      },
      default: 'PENDING_OWNER',
      index: true,
    },
    ownerResponseDeadline: {
      type: Date,
      required: true,
      index: true,
    },
    paymentDeadline: {
      type: Date,
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    expiredAt: {
      type: Date,
    },
    handoverAt: {
      type: Date,
    },
    handoverId: {
      type: String,
      trim: true,
    },
    returnedAt: {
      type: Date,
    },
    returnId: {
      type: String,
      trim: true,
    },
    lateFineAmount: {
      type: Number,
      min: 0,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for high performance date-overlap queries
BookingSchema.index({
  equipmentId: 1,
  status: 1,
  startDate: 1,
  endDate: 1,
});

// Compound index for background expiry job
BookingSchema.index({
  status: 1,
  ownerResponseDeadline: 1,
});

// Index for owner requests and renter bookings
BookingSchema.index({ ownerId: 1, createdAt: -1 });
BookingSchema.index({ renterId: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', BookingSchema);

module.exports = Booking;
