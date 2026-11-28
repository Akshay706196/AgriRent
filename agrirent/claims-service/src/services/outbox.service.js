const { getSqlDb } = require('../config/database');
const bookingClient = require('../clients/booking.client');
const logger = require('../utils/logger');

let dispatcherInterval = null;

class OutboxService {
  /**
   * Adds an event to the SQL outbox table.
   * Can be executed within an existing SQL transaction.
   */
  addEvent(db, { eventType, aggregateId, payload }) {
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO outbox (eventType, aggregateId, payload, status, attempts, createdAt)
      VALUES (?, ?, ?, 'PENDING', 0, ?)
    `);
    const result = stmt.run(eventType, aggregateId, JSON.stringify(payload), createdAt);
    return result.lastInsertRowid;
  }

  /**
   * Dispatches pending outbox events to downstream services (e.g. Booking Service).
   */
  async dispatchPendingEvents() {
    try {
      const db = getSqlDb();
      const selectStmt = db.prepare(`
        SELECT id, eventType, aggregateId, payload, attempts
        FROM outbox
        WHERE status = 'PENDING' AND attempts < 5
        ORDER BY id ASC
        LIMIT 10
      `);

      const rows = selectStmt.all();
      if (!rows || rows.length === 0) return;

      for (const row of rows) {
        const payload = JSON.parse(row.payload);

        try {
          if (row.eventType === 'SettlementCompleted') {
            await bookingClient.notifyCompletion(row.aggregateId, payload);
          }

          // Mark processed
          const updateStmt = db.prepare(`UPDATE outbox SET status = 'PROCESSED' WHERE id = ?`);
          updateStmt.run(row.id);
          logger.info(`[OutboxDispatcher] Successfully processed event ${row.id} (${row.eventType}) for ${row.aggregateId}`);
        } catch (err) {
          const now = new Date().toISOString();
          const updateFailStmt = db.prepare(`
            UPDATE outbox SET attempts = attempts + 1, lastAttemptAt = ? WHERE id = ?
          `);
          updateFailStmt.run(now, row.id);
          logger.warn(`[OutboxDispatcher] Failed to dispatch event ${row.id} (attempt ${row.attempts + 1}): ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`[OutboxDispatcher] Polling error: ${err.message}`);
    }
  }

  startDispatcher(intervalMs = 5000) {
    if (!dispatcherInterval) {
      dispatcherInterval = setInterval(() => this.dispatchPendingEvents(), intervalMs);
      logger.info(`[OutboxDispatcher] Background dispatcher started (polling every ${intervalMs}ms)`);
    }
  }

  stopDispatcher() {
    if (dispatcherInterval) {
      clearInterval(dispatcherInterval);
      dispatcherInterval = null;
      logger.info('[OutboxDispatcher] Background dispatcher stopped.');
    }
  }
}

module.exports = new OutboxService();
