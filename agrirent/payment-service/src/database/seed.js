const { initSqlDb } = require('../config/database');
const logger = require('../utils/logger');

function runSeeds() {
  const db = initSqlDb();

  logger.info('[Seed] Seeding sample payment and deposit records...');

  const now = new Date().toISOString();

  // Seed sample payment
  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO payments (
      paymentId, bookingId, renterId, rentalAmount, platformFee, securityDeposit,
      totalAmount, currency, status, gateway, gatewayOrderId, gatewayPaymentId,
      transactionReference, refundedAmount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run(
    'PAY-SEED001',
    'BK-SEED001',
    'USR-RENTER01',
    300000, // 3000.00 INR in paise
    30000,  // 300.00 INR
    50000,  // 500.00 INR
    380000, // 3800.00 INR
    'INR',
    'CONFIRMED',
    'simulator',
    'order_seed_001',
    'pay_seed_001',
    'TXN-SEED001',
    0,
    now,
    now
  );

  // Seed sample held deposit
  const insertDeposit = db.prepare(`
    INSERT OR IGNORE INTO deposits (
      depositId, bookingId, paymentId, renterId, depositAmount, heldAmount,
      status, paymentReference, heldAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDeposit.run(
    'DEP-SEED001',
    'BK-SEED001',
    'PAY-SEED001',
    'USR-RENTER01',
    50000,
    50000,
    'HELD',
    'TXN-SEED001',
    now,
    now,
    now
  );

  logger.info('[Seed] Seeding completed successfully.');
}

if (require.main === module) {
  try {
    runSeeds();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

module.exports = runSeeds;
