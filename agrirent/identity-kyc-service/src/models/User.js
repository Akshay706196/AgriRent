const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: () => `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      index: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      select: false, // Don't return passwordHash by default in queries
    },
    accountStatus: {
      type: String,
      enum: {
        values: ['ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED'],
        message: '{VALUE} is not a valid account status',
      },
      default: 'ACTIVE',
      index: true,
    },
    kycStatus: {
      type: String,
      enum: {
        values: [
          'NOT_SUBMITTED',
          'PENDING',
          'UNDER_REVIEW',
          'VERIFIED',
          'REJECTED',
          'RESUBMISSION_REQUIRED',
        ],
        message: '{VALUE} is not a valid KYC status',
      },
      default: 'NOT_SUBMITTED',
      index: true,
    },
    roles: {
      type: [String],
      enum: ['USER', 'ADMIN'],
      default: ['USER'],
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Method to get a clean safe user object
UserSchema.methods.toSafeObject = function () {
  return {
    userId: this.userId,
    name: this.name,
    email: this.email,
    phone: this.phone,
    accountStatus: this.accountStatus,
    kycStatus: this.kycStatus,
    roles: this.roles,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastLoginAt: this.lastLoginAt,
  };
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
