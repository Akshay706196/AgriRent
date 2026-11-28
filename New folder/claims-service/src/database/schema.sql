-- ==============================================================================
-- AgriRent Service 6: Claims, Disputes & Reviews Service (SQL Ledger Schema)
-- Database Engine: SQLite (node:sqlite DatabaseSync)
-- Currency & Money: Integer Minor Units (paise: 1 INR = 100 paise)
-- ==============================================================================

-- 1. Rental Case Snapshots (Local copy from Booking, Handover & Payment)
CREATE TABLE IF NOT EXISTS rental_cases (
  bookingId TEXT PRIMARY KEY,
  renterId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  returnedAt TEXT NOT NULL,
  lateFineAmount INTEGER NOT NULL DEFAULT 0,
  depositHeld INTEGER NOT NULL DEFAULT 0,
  rentalAmount INTEGER NOT NULL DEFAULT 0,
  platformFee INTEGER NOT NULL DEFAULT 0,
  claimWindowClosesAt TEXT NOT NULL,
  waivedAt TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- 2. Damage Claims Table
CREATE TABLE IF NOT EXISTS claims (
  claimId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL,
  claimantId TEXT NOT NULL,
  reason TEXT NOT NULL,
  claimedAmount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  windowClosesAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (bookingId) REFERENCES rental_cases(bookingId)
);

CREATE INDEX IF NOT EXISTS idx_claims_booking ON claims (bookingId);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims (status);

-- 3. Claim Decisions Table (Admin evaluation, strictly 1 decision per claim)
CREATE TABLE IF NOT EXISTS claim_decisions (
  decisionId TEXT PRIMARY KEY,
  claimId TEXT NOT NULL UNIQUE,
  bookingId TEXT NOT NULL,
  decision TEXT NOT NULL,
  approvedAmount INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  decidedBy TEXT NOT NULL,
  decidedAt TEXT NOT NULL,
  FOREIGN KEY (claimId) REFERENCES claims(claimId)
);

CREATE INDEX IF NOT EXISTS idx_decisions_booking ON claim_decisions (bookingId);

-- 4. Disputes Table (Renter disputes against claims, at most 1 OPEN dispute per claim)
CREATE TABLE IF NOT EXISTS disputes (
  disputeId TEXT PRIMARY KEY,
  claimId TEXT NOT NULL,
  bookingId TEXT NOT NULL,
  raisedBy TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  decision TEXT,
  decisionReason TEXT,
  resolvedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (claimId) REFERENCES claims(claimId)
);

CREATE INDEX IF NOT EXISTS idx_disputes_claim ON disputes (claimId);
CREATE INDEX IF NOT EXISTS idx_disputes_booking ON disputes (bookingId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_open_per_claim ON disputes (claimId) WHERE status = 'OPEN';

-- 5. Reviews Table (Peer reviews between participants, max 1 review per (booking, reviewer))
CREATE TABLE IF NOT EXISTS reviews (
  reviewId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL,
  reviewerId TEXT NOT NULL,
  targetUserId TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  createdAt TEXT NOT NULL,
  UNIQUE(bookingId, reviewerId)
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews (targetUserId);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews (bookingId);

-- 6. Settlement Requests Table (Saga execution state, strictly 1 per booking)
CREATE TABLE IF NOT EXISTS settlement_requests (
  requestId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  rentalAmount INTEGER NOT NULL,
  lateFine INTEGER NOT NULL,
  damageDeduction INTEGER NOT NULL,
  depositBalance INTEGER NOT NULL,
  settlementId TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastAttemptAt TEXT,
  failureReason TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (bookingId) REFERENCES rental_cases(bookingId)
);

CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlement_requests (status);

-- 7. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  responseCode INTEGER,
  responseHeaders TEXT,
  responseBody TEXT,
  status TEXT NOT NULL DEFAULT 'STARTED',
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

-- 8. Transactional Outbox Table
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventType TEXT NOT NULL,
  aggregateId TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  lastAttemptAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status, attempts);
