const mongoose = require('mongoose');

const ClaimEventSchema = new mongoose.Schema(
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
    claimId: {
      type: String,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'CaseCreated',
        'ClaimSubmitted',
        'EvidenceItemAdded',
        'DisputeRaised',
        'DamageClaimApproved',
        'DamageClaimPartiallyApproved',
        'DamageClaimRejected',
        'ReviewSubmitted',
        'ClaimWaived',
        'SettlementRequested',
        'SettlementCompleted',
        'SettlementFailed',
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
    collection: 'claim_events',
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

ClaimEventSchema.index({ claimId: 1, timestamp: -1 });
ClaimEventSchema.index({ bookingId: 1, timestamp: -1 });

const ClaimEvent = mongoose.model('ClaimEvent', ClaimEventSchema);

module.exports = ClaimEvent;
