const mongoose = require('mongoose');
const crypto = require('crypto');

const PaymentEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: () => `EVT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    },
    paymentId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    bookingId: {
      type: String,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'PaymentInitiated',
        'PaymentConfirmed',
        'PaymentFailed',
        'DepositHeld',
        'DepositReleased',
        'RefundCompleted',
        'SettlementCompleted',
        'WebhookReceived',
      ],
      index: true,
    },
    actor: {
      type: String,
      required: true,
      default: 'system',
    },
    entityId: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    correlationId: {
      type: String,
      default: 'unknown',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
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

PaymentEventSchema.index({ paymentId: 1, timestamp: -1 });

const PaymentEvent = mongoose.models.PaymentEvent || mongoose.model('PaymentEvent', PaymentEventSchema);

module.exports = PaymentEvent;
