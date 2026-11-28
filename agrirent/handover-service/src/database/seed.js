const { initSqlDb } = require('../config/database');
const logger = require('../utils/logger');
const { hashPin } = require('../utils/pin');

function seed() {
  const db = initSqlDb();

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Clean demo seed records
  db.exec("DELETE FROM pins WHERE bookingId LIKE 'BK-SEED-%'");
  db.exec("DELETE FROM handovers WHERE bookingId LIKE 'BK-SEED-%'");
  db.exec("DELETE FROM returns WHERE bookingId LIKE 'BK-SEED-%'");
  db.exec("DELETE FROM late_fines WHERE bookingId LIKE 'BK-SEED-%'");

  const pinHash = hashPin('123456');

  // Seed sample active handover PIN
  db.prepare(`
    INSERT INTO pins (pinId, bookingId, type, hashedPin, status, deliveryStatus, attempts, maxAttempts, expiresAt, createdAt, updatedAt)
    VALUES (?, ?, 'HANDOVER', ?, 'ACTIVE', 'DELIVERED', 0, 3, ?, ?, ?)
  `).run('PIN-SEED-HO-01', 'BK-SEED-01', pinHash, expiresAt, now, now);

  // Seed sample completed handover
  db.prepare(`
    INSERT INTO pins (pinId, bookingId, type, hashedPin, status, deliveryStatus, attempts, maxAttempts, expiresAt, usedAt, createdAt, updatedAt)
    VALUES (?, ?, 'HANDOVER', ?, 'USED', 'DELIVERED', 0, 3, ?, ?, ?, ?)
  `).run('PIN-SEED-HO-02', 'BK-SEED-02', pinHash, expiresAt, now, now, now);

  db.prepare(`
    INSERT INTO handovers (handoverId, bookingId, pinId, handedOverBy, handedOverTo, handedOverAt, status, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'IN_RENTAL', ?, ?, ?)
  `).run('HO-SEED-02', 'BK-SEED-02', 'PIN-SEED-HO-02', 'USR-OWNER-01', 'USR-RENTER-01', now, 'Seeded handover baseline', now, now);

  logger.info('[Seed] Handover database seeded with demo baseline records.');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
