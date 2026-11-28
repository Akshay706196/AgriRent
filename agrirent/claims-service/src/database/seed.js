const { initSqlDb } = require('../config/database');
const logger = require('../utils/logger');

function seed() {
  const db = initSqlDb();

  // Clear existing demo records
  db.exec(`
    DELETE FROM claim_decisions WHERE claimId LIKE 'CLM-SEED-%';
    DELETE FROM disputes WHERE claimId LIKE 'CLM-SEED-%';
    DELETE FROM claims WHERE claimId LIKE 'CLM-SEED-%';
    DELETE FROM reviews WHERE reviewId LIKE 'REV-SEED-%';
    DELETE FROM rental_cases WHERE bookingId LIKE 'BK-SEED-%';
  `);

  const now = new Date().toISOString();
  const windowClosesAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  // Seed sample case
  db.prepare(`
    INSERT INTO rental_cases (
      bookingId, renterId, ownerId, returnedAt, lateFineAmount, depositHeld,
      rentalAmount, platformFee, claimWindowClosesAt, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(
    'BK-SEED-001',
    'USR-RENTER-101',
    'USR-OWNER-201',
    now,
    0,
    50000, // 500 INR in paise
    300000, // 3000 INR
    30000,  // 300 INR
    windowClosesAt,
    now,
    now
  );

  // Seed sample claim
  db.prepare(`
    INSERT INTO claims (
      claimId, bookingId, claimantId, reason, claimedAmount, status, windowClosesAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?)
  `).run(
    'CLM-SEED-001',
    'BK-SEED-001',
    'USR-OWNER-201',
    'Cracked hydraulic hose on tractor during operation',
    15000, // 150 INR in paise
    windowClosesAt,
    now,
    now
  );

  logger.info('[Seed] Claims service seed data inserted successfully.');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
