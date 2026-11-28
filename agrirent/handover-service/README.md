# AgriRent Handover, Return & Late-Fine Microservice (Service 5)

Service 5 is responsible for physical possession verification of rented agricultural machinery, single-use cryptographic PIN lifecycle management, condition report capture (for future Claims & Disputes comparison), outbox state synchronization (`PAID -> IN_RENTAL -> RETURNED`), and automated late fine penalty assessment across the AgriRent peer-to-peer agricultural equipment rental platform.

---

## Architecture & Technology Stack

- **Runtime & Framework**: Node.js 24 (`node:sqlite` DatabaseSync) + Express.js.
- **Service Port**: `4005` (Swagger UI at `/docs`, WSDL at `/soap/handover?wsdl`).
- **Dual-Store Architecture**:
  - **SQL Ledger Engine**: Native SQLite with parameterized queries (`?`), transactions (`BEGIN IMMEDIATE` ... `COMMIT`), and constraints for machine records (`pins`, `handovers`, `returns`, `late_fines`, `idempotency_keys`, `outbox`).
  - **NoSQL Document Store**: MongoDB (`handover_events` collection) for audit trails, PIN events (generated, delivered, attempt failed, locked, expired), and condition reports (engine hours, fuel level, cleanliness, visual notes, photos).
- **Cryptographic PIN Security**:
  - 6-digit random codes generated via cryptographic PRNG (`crypto.randomInt(100000, 1000000)`).
  - Stored strictly as HMAC-SHA256 hashes using a secret server pepper (`PIN_PEPPER`); constant-time comparison via `crypto.timingSafeEqual`.
  - Single-use enforced atomically inside SQL transactions.
  - Locked (HTTP 423 `PIN_LOCKED`) after 3 failed attempts.
  - Plaintext PIN is never stored in databases, never in logs, never in idempotency snapshots.
  - Production Guard: Service strictly refuses to start if `DEV_EXPOSE_PIN=true` or `TIME_OVERRIDE_ISO` in `NODE_ENV=production`.
- **Authoritative Late Fine Formula**:
  - `dueAt`: booking `endDate` at 00:00:00 in `BUSINESS_TIMEZONE` (`Asia/Kolkata` / UTC+05:30), reflecting exclusive end date convention.
  - `threshold`: `dueAt + GRACE_PERIOD_MINUTES` (default 30 mins).
  - `overdue`: `actualReturn - threshold`.
  - If `overdue <= 0` -> fine = 0.
  - Else `overdueDays = Math.ceil(overdue / 24h)`.
  - `fine = overdueDays * LATE_FINE_DAILY_RATE` (stored internally in integer minor paise).
  - Capped at booking's security deposit when `LATE_FINE_CAP_AT_DEPOSIT=true`.
- **Reliable Notification**: Transactional outbox pattern with background worker retrying downstream Booking Service updates with exponential backoff and jitter (`EquipmentHandedOver` -> `PAID -> IN_RENTAL`, `EquipmentReturned` -> `IN_RENTAL -> RETURNED`).

---

## Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `4005` | Service HTTP port |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`) |
| `SQL_DB_PATH` | `./data/agrirent_handovers.sqlite` | SQLite database file location |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/agrirent_handovers` | MongoDB connection URI for events |
| `BOOKING_SERVICE_URL` | `http://localhost:4002` | Downstream Booking Management Service URL |
| `PAYMENT_SERVICE_URL` | `http://localhost:4004` | Downstream Payment Service URL |
| `IDENTITY_SERVICE_URL` | `http://localhost:4003` | Downstream Identity & KYC Service URL |
| `INTERNAL_SERVICE_TOKEN` | `agrirent_internal_service_token_2026` | Service-to-service shared secret token |
| `JWT_SECRET` | `agrirent_super_secret_jwt_key_2026_dev` | Secret for verifying user JWT tokens |
| `PIN_PEPPER` | `agrirent_pin_pepper_2026_dev` | Secret pepper for HMAC-SHA256 PIN hashing |
| `PIN_TTL_MINUTES` | `30` | PIN validity duration |
| `MAX_PIN_ATTEMPTS` | `3` | Maximum attempts before HTTP 423 PIN locking |
| `DEV_EXPOSE_PIN` | `true` | Dev/test only flag to expose plaintext PIN in responses |
| `BUSINESS_TIMEZONE` | `Asia/Kolkata` | Business timezone for due date calculation |
| `GRACE_PERIOD_MINUTES` | `30` | Grace period duration before late fines accumulate |
| `LATE_FINE_DAILY_RATE` | `300000` | Daily late penalty rate in paise (3000.00 INR) |
| `LATE_FINE_CAP_AT_DEPOSIT` | `true` | When true, caps maximum fine at booking security deposit |
| `OUTBOUND_TIMEOUT_MS` | `5000` | Outbound HTTP timeout (aborts to 504) |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `3` | Consecutive failures before tripping breaker to OPEN |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | `10000` | Cooldown duration before HALF-OPEN probe |

---

## Commands to Run

```bash
# 1. Install dependencies
npm install

# 2. Run SQL migrations
npm run migrate

# 3. Seed demo data
npm run seed

# 4. Run automated test suite (Jest + Supertest)
npm test

# 5. Start service in development mode
npm run dev

# 6. Start service in production mode
npm start

# 7. Run SOAP Client
node scripts/soapClient.js <bookingId> <returnTimeISO>

# 8. Run End-to-End Integration Smoke Test
node scripts/e2e-handover.js
```

---

## API Operations

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/bookings/:bookingId/handover-pins` | Renter generates single-use 6-digit handover PIN |
| `POST` | `/v1/bookings/:bookingId/handovers` | Owner verifies PIN; transitions booking to `IN_RENTAL` |
| `POST` | `/v1/bookings/:bookingId/return-pins` | Renter generates single-use 6-digit return PIN |
| `POST` | `/v1/bookings/:bookingId/returns` | Owner verifies return PIN; transitions to `RETURNED` & assesses late fine |
| `GET` | `/v1/bookings/:bookingId/late-fine` | Retrieves stored late fine or preview penalty (`?returnTime=`) |
| `GET` | `/v1/bookings/:bookingId/handovers/:id` | Handover record (supports ETag 304 and XML) |
| `GET` | `/v1/bookings/:bookingId/returns/:id` | Return record (supports ETag 304 and XML) |
| `GET` | `/v1/handovers` | Cursor-paginated handovers with `Link` header |
| `GET` | `/v1/bookings/:bookingId/events` | Cursor-paginated MongoDB event timeline and condition reports |
| `GET` | `/health` / `/ready` | Service liveness and database readiness probes |
| `GET` | `/docs` / `/openapi.yaml` | Swagger UI documentation & raw OpenAPI 3.0 spec |
| `GET` | `/soap/handover?wsdl` | Handover SOAP WSDL endpoint |
| `POST`| `/soap/handover` | SOAP `CalculateLateFine` operation |
