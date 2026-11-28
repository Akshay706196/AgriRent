const mongoose = require('mongoose');
const crypto = require('crypto');

const EquipmentSchema = new mongoose.Schema(
  {
    equipmentId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: () => `EQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    },
    ownerId: {
      type: String,
      required: [true, 'ownerId is required'],
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Equipment name is required'],
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['TRACTOR', 'HARVESTER', 'ROTAVATOR', 'SEEDER', 'OTHER'],
        message: '{VALUE} is not a valid equipment category',
      },
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 2000,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    model: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    manufacturingYear: {
      type: Number,
      min: [1950, 'Manufacturing year cannot be older than 1950'],
      max: [new Date().getFullYear() + 1, 'Manufacturing year cannot be in the distant future'],
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: {
        values: ['NEW', 'GOOD', 'FAIR'],
        message: '{VALUE} is not a valid condition',
      },
      uppercase: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    pricePerDay: {
      type: Number,
      required: [true, 'pricePerDay is required'],
      min: [1, 'Price per day must be greater than zero'],
      index: true,
    },
    securityDeposit: {
      type: Number,
      required: [true, 'securityDeposit is required'],
      min: [0, 'Security deposit must be zero or greater'],
      default: 0,
    },
    pickupAddress: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true, index: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    termsAndConditions: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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

// Geospatial index for radius/nearby queries
EquipmentSchema.index({ location: '2dsphere' }, { sparse: true });

// Compound indexes for optimized public searches
EquipmentSchema.index({ status: 1, isDeleted: 1, category: 1, pricePerDay: 1 });
EquipmentSchema.index({ status: 1, isDeleted: 1, 'pickupAddress.city': 1 });

const Equipment = mongoose.model('Equipment', EquipmentSchema);

module.exports = Equipment;
