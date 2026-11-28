const mongoose = require('mongoose');

const HandoverEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bookingId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'PinGenerated',
        'PinDelivered',
        'PinAttemptFailed',
        'PinAttemptSucceeded',
        'PinLocked',
        'PinExpired',
        'PinSuperseded',
        'EquipmentHandedOver',
        'EquipmentReturned',
        'LateFineCalculated',
      ],
      index: true,
    },
    actor: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
      default: 'SYSTEM',
    },
    pinId: {
      type: String,
      index: true,
    },
    pinType: {
      type: String,
      enum: ['HANDOVER', 'RETURN'],
    },
    // Condition report captured at handover or return (for future Claims & Disputes comparison)
    conditionReport: {
      engineHours: { type: Number },
      fuelLevelPercent: { type: Number, min: 0, max: 100 },
      cleanliness: { type: String, enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DIRTY'] },
      visualInspectionNotes: { type: String },
      photoUrls: [{ type: String }],
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    correlationId: {
      type: String,
      default: 'system',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'handover_events',
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

HandoverEventSchema.index({ bookingId: 1, timestamp: -1 });

const HandoverEvent = mongoose.model('HandoverEvent', HandoverEventSchema);

module.exports = HandoverEvent;
