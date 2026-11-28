const PaymentEvent = require('../models/PaymentEvent');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

class EventService {
  /**
   * Records an audit / domain event in the MongoDB payment_events collection.
   */
  async recordEvent({
    paymentId,
    bookingId,
    eventType,
    actor = 'system',
    entityId,
    payload = {},
    correlationId = 'internal',
  }) {
    try {
      const event = await PaymentEvent.create({
        paymentId,
        bookingId,
        eventType,
        actor,
        entityId,
        payload,
        correlationId,
        timestamp: new Date(),
      });
      return event;
    } catch (err) {
      logger.warn(`[EventService] Could not persist event to MongoDB: ${err.message}`);
      return null;
    }
  }

  /**
   * Retrieves events for a payment with opaque cursor pagination.
   */
  async getPaymentEvents(paymentId, { limit = 10, cursor = null }) {
    const query = { paymentId };

    if (cursor) {
      try {
        const decodedDate = new Date(Buffer.from(cursor, 'base64').toString('ascii'));
        if (!isNaN(decodedDate.getTime())) {
          query.timestamp = { $lt: decodedDate };
        }
      } catch {
        // Fallback or ignore invalid cursor
      }
    }

    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const events = await PaymentEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(pageSize + 1);

    const hasMore = events.length > pageSize;
    const items = hasMore ? events.slice(0, pageSize) : events;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(lastItem.timestamp.toISOString()).toString('base64');
    }

    return {
      items,
      hasMore,
      nextCursor,
    };
  }
}

module.exports = new EventService();
