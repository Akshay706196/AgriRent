-- AgriRent Handover, Return & Late-Fine Service (Service 5) SQL Schema

CREATE TABLE IF NOT EXISTS pins (
  pinId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('HANDOVER', 'RETURN')),
  hashedPin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'USED', 'EXPIRED', 'LOCKED', 'SUPERSEDED')),
  deliveryStatus TEXT NOT NULL DEFAULT 'DELIVERED',
  attempts INTEGER NOT NULL DEFAULT 0,
  maxAttempts INTEGER NOT NULL DEFAULT 3,
  expiresAt TEXT NOT NULL,
  usedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- At most one ACTIVE pin per (booking, type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pins_active_booking_type ON pins(bookingId, type) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_pins_bookingId ON pins(bookingId);
CREATE INDEX IF NOT EXISTS idx_pins_status ON pins(status);

CREATE TABLE IF NOT EXISTS handovers (
  handoverId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL UNIQUE,
  pinId TEXT NOT NULL,
  handedOverBy TEXT NOT NULL,
  handedOverTo TEXT NOT NULL,
  handedOverAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_RENTAL',
  conditionReportRef TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (pinId) REFERENCES pins(pinId)
);

CREATE INDEX IF NOT EXISTS idx_handovers_bookingId ON handovers(bookingId);
CREATE INDEX IF NOT EXISTS idx_handovers_pinId ON handovers(pinId);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON handovers(status);

CREATE TABLE IF NOT EXISTS returns (
  returnId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL UNIQUE,
  pinId TEXT NOT NULL,
  returnedBy TEXT NOT NULL,
  returnedTo TEXT NOT NULL,
  returnedAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RETURNED',
  conditionReportRef TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (pinId) REFERENCES pins(pinId)
);

CREATE INDEX IF NOT EXISTS idx_returns_bookingId ON returns(bookingId);
CREATE INDEX IF NOT EXISTS idx_returns_pinId ON returns(pinId);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

CREATE TABLE IF NOT EXISTS late_fines (
  fineId TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL UNIQUE,
  returnId TEXT NOT NULL,
  dueDate TEXT NOT NULL,
  actualReturn TEXT NOT NULL,
  gracePeriodMinutes INTEGER NOT NULL,
  overdueDuration TEXT NOT NULL,
  overdueMinutes INTEGER NOT NULL,
  overdueDays INTEGER NOT NULL,
  dailyRate INTEGER NOT NULL,
  fineAmount INTEGER NOT NULL,
  depositCapApplied INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'ASSESSED',
  calculatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (returnId) REFERENCES returns(returnId)
);

CREATE INDEX IF NOT EXISTS idx_late_fines_bookingId ON late_fines(bookingId);
CREATE INDEX IF NOT EXISTS idx_late_fines_returnId ON late_fines(returnId);

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
