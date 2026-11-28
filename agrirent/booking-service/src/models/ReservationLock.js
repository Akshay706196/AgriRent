const mongoose = require('mongoose');

const ReservationLockSchema = new mongoose.Schema(
  {
    equipmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Atomically acquires a mutual exclusion lock for an equipmentId.
 * Serializes concurrent booking requests for the same piece of equipment.
 */
ReservationLockSchema.statics.acquire = async function (equipmentId, maxWaitMs = 3000, staleThresholdMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const staleTime = new Date(Date.now() - staleThresholdMs);

    try {
      const lock = await this.findOneAndUpdate(
        {
          equipmentId,
          $or: [{ isLocked: false }, { lockedAt: { $lt: staleTime } }],
        },
        {
          $set: {
            isLocked: true,
            lockedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      if (lock) {
        return lock;
      }
    } catch (err) {
      // Catch possible unique constraint upsert race
      if (err.code !== 11000) throw err;
    }

    // Brief backoff before next attempt
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Failed to acquire reservation lock for equipment ${equipmentId} within ${maxWaitMs}ms`);
};

/**
 * Releases the lock for the given equipmentId.
 */
ReservationLockSchema.statics.release = async function (equipmentId) {
  await this.updateOne(
    { equipmentId },
    { $set: { isLocked: false, lockedAt: null } }
  );
};

const ReservationLock = mongoose.model('ReservationLock', ReservationLockSchema);

module.exports = ReservationLock;
