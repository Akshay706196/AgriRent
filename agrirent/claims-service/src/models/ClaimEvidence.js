const mongoose = require('mongoose');

const ClaimEvidenceSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    claimId: {
      type: String,
      required: true,
      index: true,
    },
    bookingId: {
      type: String,
      required: true,
      index: true,
    },
    photos: [
      {
        type: String,
      },
    ],
    notes: {
      type: String,
    },
    conditionReportSnapshot: {
      handoverConditionReport: {
        engineHours: Number,
        fuelLevelPercent: Number,
        cleanliness: String,
        visualInspectionNotes: String,
        photoUrls: [String],
      },
      returnConditionReport: {
        engineHours: Number,
        fuelLevelPercent: Number,
        cleanliness: String,
        visualInspectionNotes: String,
        photoUrls: [String],
      },
      handoverAt: Date,
      returnedAt: Date,
    },
    addedBy: {
      type: String,
      required: true,
    },
    isImmutable: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'claim_evidence',
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

ClaimEvidenceSchema.index({ claimId: 1, createdAt: 1 });

const ClaimEvidence = mongoose.model('ClaimEvidence', ClaimEvidenceSchema);

module.exports = ClaimEvidence;
