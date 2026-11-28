const crypto = require('crypto');
const HandoverEvent = require('../models/HandoverEvent');
const logger = require('../utils/logger');

class EventService {
  /**
   * Persists an audit event to the handover_events Mongo collection.
   * NEVER stores or logs the plaintext PIN.
   */
  async recordEvent({
    bookingId,
    eventType,
    actor,
    actorRole = 'SYSTEM',
    pinId = null,
    pinType = null,
    conditionReport = null,
    payload = {},
    correlationId = 'system',
  }) {
    const eventId = `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    // Sanitization: Guarantee no PIN field exists in payload
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.pin;
    delete sanitizedPayload.hashedPin;

    try {
      const doc = await HandoverEvent.create({
        eventId,
        bookingId,
        eventType,
        actor,
        actorRole,
        pinId,
        pinType,
        conditionReport: conditionReport || undefined,
        payload: sanitizedPayload,
        correlationId,
        timestamp: new Date(),
      });

      logger.info(`[AuditTrail] Recorded event ${eventType} (${eventId}) for booking ${bookingId}`);
      return doc;
    } catch (err) {
      logger.warn(`[AuditTrail] Could not persist event to MongoDB: ${err.message}. Operation will continue.`);
      return null;
    }
  }

  /**
   * Retrieves cursor-paginated event audit trail for a booking.
   */
  async listEvents({ bookingId, limit = 10, cursor = null }) {
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const query = { bookingId };
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorTimestamp, cursorId] = decoded.split('_');
        query.$or = [
          { timestamp: { $lt: new Date(cursorTimestamp) } },
          { timestamp: new Date(cursorTimestamp), _id: { $lt: cursorId } },
        ];
      } catch {
        // Invalid cursor ignored
      }
    }

    const items = await HandoverEvent.find(query)
      .sort({ timestamp: -1, _id: -1 })
      .limit(pageSize + 1);

    const hasMore = items.length > pageSize;
    const pagedItems = hasMore ? items.slice(0, pageSize) : items;

    let nextCursor = null;
    if (hasMore && pagedItems.length > 0) {
      const lastItem = pagedItems[pagedItems.length - 1];
      const rawCursor = `${lastItem.timestamp.toISOString()}_${lastItem._id}`;
      nextCursor = Buffer.from(rawCursor).toString('base64');
    }

    return {
      items: pagedItems.map((evt) => ({
        eventId: evt.eventId,
        bookingId: evt.bookingId,
        eventType: evt.eventType,
        actor: evt.actor,
        actorRole: evt.actorRole,
        pinId: evt.pinId,
        pinType: evt.pinType,
        conditionReport: evt.conditionReport,
        payload: evt.payload,
        correlationId: evt.correlationId,
        timestamp: evt.timestamp,
      })),
      hasMore,
      nextCursor,
    };
  }

  /**
   * Retrieves before/after condition reports snapshot for a booking (for Claims Service).
   */
  async getConditionReports(bookingId) {
    const events = await HandoverEvent.find({
      bookingId,
      eventType: { $in: ['EquipmentHandedOver', 'EquipmentReturned'] },
    }).sort({ timestamp: 1 });

    const handoverEvt = events.find((e) => e.eventType === 'EquipmentHandedOver');
    const returnEvt = events.find((e) => e.eventType === 'EquipmentReturned');

    return {
      bookingId,
      handoverConditionReport: handoverEvt ? handoverEvt.conditionReport : null,
      returnConditionReport: returnEvt ? returnEvt.conditionReport : null,
      handoverAt: handoverEvt ? handoverEvt.timestamp : null,
      returnedAt: returnEvt ? returnEvt.timestamp : null,
    };
  }
}

module.exports = new EventService();
