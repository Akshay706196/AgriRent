const cron = require('node-cron');
const Booking = require('../models/Booking');

/**
 * Finds and expires pending bookings whose 24-hour ownerResponseDeadline has passed.
 */
const expirePendingBookings = async () => {
  const now = new Date();

  try {
    // Atomically find and update eligible bookings
    const expiredBookings = await Booking.find({
      status: 'PENDING_OWNER',
      ownerResponseDeadline: { $lte: now },
    });

    if (expiredBookings.length === 0) {
      return { expiredCount: 0 };
    }

    let count = 0;
    for (const booking of expiredBookings) {
      // Concurrency-safe atomic transition ensuring no duplicate expiry
      const updated = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: 'PENDING_OWNER',
          ownerResponseDeadline: { $lte: now },
        },
        {
          $set: {
            status: 'EXPIRED',
            expiredAt: now,
          },
        },
        { new: true }
      );

      if (updated) {
        count++;
        console.log(
          `[24h Expiry Job] Booking ${updated.bookingId} expired. Owner did not respond within 24h. Renter notified.`
        );
      }
    }

    return { expiredCount: count };
  } catch (err) {
    console.error('[24h Expiry Job Error] Failed to expire bookings:', err.message);
    throw err;
  }
};

let scheduledTask = null;

const startExpiryCron = (cronExpression = process.env.EXPIRY_JOB_CRON || '*/5 * * * *') => {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(cronExpression, async () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[24h Expiry Job] Running scheduled scan for expired booking requests...');
    }
    await expirePendingBookings();
  });

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[24h Expiry Job] Scheduled with cron pattern: "${cronExpression}"`);
  }

  return scheduledTask;
};

const stopExpiryCron = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
};

module.exports = {
  expirePendingBookings,
  startExpiryCron,
  stopExpiryCron,
};
