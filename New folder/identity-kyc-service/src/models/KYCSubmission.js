const mongoose = require('mongoose');
const crypto = require('crypto');

const KYCSubmissionSchema = new mongoose.Schema(
  {
    kycId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: () => `KYC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    },
    userId: {
      type: String,
      required: [true, 'userId is required'],
      index: true,
      trim: true,
    },
    documentType: {
      type: String,
      required: [true, 'documentType is required'],
      enum: {
        values: [
          'GOVERNMENT_ID',
          'AADHAAR',
          'PAN',
          'DRIVING_LICENSE',
          'PASSPORT',
          'VOTER_ID',
          'FARMER_ID',
        ],
        message: '{VALUE} is not a supported KYC document type',
      },
      uppercase: true,
      index: true,
    },
    documentReference: {
      type: String,
      required: [true, 'documentReference is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          'PENDING',
          'UNDER_REVIEW',
          'VERIFIED',
          'REJECTED',
          'RESUBMISSION_REQUIRED',
        ],
        message: '{VALUE} is not a valid submission status',
      },
      default: 'PENDING',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    decisionNote: {
      type: String,
      default: null,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isCurrent: {
      type: Boolean,
      default: true,
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

// Compound indexes
KYCSubmissionSchema.index({ userId: 1, isCurrent: 1 });
KYCSubmissionSchema.index({ status: 1, submittedAt: -1 });

const KYCSubmission = mongoose.model('KYCSubmission', KYCSubmissionSchema);

module.exports = KYCSubmission;
