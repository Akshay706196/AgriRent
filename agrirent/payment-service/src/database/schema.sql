-- AgriRent Payment & Security Deposit Service (Service 4) SQL Schema

CREATE TABLE IF NOT EXISTS payments (
  paymentId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL,
  renterId TEXT NOT NULL,
  rentalAmount INTEGER NOT NULL,
  platformFee INTEGER NOT NULL,
  securityDeposit INTEGER NOT NULL,
  totalAmount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL,
  gateway TEXT NOT NULL,
  gatewayOrderId TEXT,
  gatewayPaymentId TEXT,
  transactionReference TEXT,
  refundedAmount INTEGER DEFAULT 0,
  failedReason TEXT,
  verifiedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_bookingId ON payments(bookingId);
CREATE INDEX IF NOT EXISTS idx_payments_renterId ON payments(renterId);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS deposits (
  depositId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL UNIQUE,
  paymentId TEXT NOT NULL,
  renterId TEXT NOT NULL,
  depositAmount INTEGER NOT NULL,
  heldAmount INTEGER NOT NULL,
  status TEXT NOT NULL,
  paymentReference TEXT,
  heldAt TEXT NOT NULL,
  releasedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (paymentId) REFERENCES payments(paymentId)
);

CREATE INDEX IF NOT EXISTS idx_deposits_bookingId ON deposits(bookingId);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

CREATE TABLE IF NOT EXISTS refunds (
  refundId TEXT PRIMARY KEY,
  paymentId TEXT NOT NULL,
  bookingId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  gatewayRefundId TEXT,
  idempotencyKey TEXT UNIQUE,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (paymentId) REFERENCES payments(paymentId)
);

CREATE INDEX IF NOT EXISTS idx_refunds_paymentId ON refunds(paymentId);
CREATE INDEX IF NOT EXISTS idx_refunds_bookingId ON refunds(bookingId);

CREATE TABLE IF NOT EXISTS settlements (
  settlementId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL UNIQUE,
  paymentId TEXT NOT NULL,
  depositId TEXT,
  rentalAmount INTEGER NOT NULL,
  platformFee INTEGER NOT NULL,
  heldDeposit INTEGER NOT NULL,
  lateFine INTEGER DEFAULT 0,
  damageDeduction INTEGER DEFAULT 0,
  depositBalance INTEGER NOT NULL,
  refundToRenter INTEGER NOT NULL,
  ownerPayout INTEGER NOT NULL,
  disputedAmount INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  settledAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (paymentId) REFERENCES payments(paymentId)
);

CREATE INDEX IF NOT EXISTS idx_settlements_bookingId ON settlements(bookingId);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  requestPath TEXT NOT NULL,
  requestMethod TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  responseCode INTEGER NOT NULL,
  responseBody TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiresAt ON idempotency_keys(expiresAt);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventType TEXT NOT NULL,
  aggregateId TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  attempts INTEGER DEFAULT 0,
  lastAttemptAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, createdAt);
