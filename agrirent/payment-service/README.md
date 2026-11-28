# AgriRent Payment & Security Deposit Microservice (Service 4)

Service 4 is responsible for collecting rental charges and escrow security deposits through payment gateways, managing partial and full refunds, and executing final settlements across the AgriRent peer-to-peer agricultural equipment rental platform.

---

## Architecture & Technology Stack

- **Runtime & Framework**: Node.js 24 (`node:sqlite` DatabaseSync) + Express.js.
- **Service Port**: `4004` (Swagger UI at `/docs`, WSDL at `/soap/payments?wsdl`).
- **Dual-Store Architecture**:
  - **SQL Ledger Engine**: Native SQLite with parameterized queries (`?`), transactions (`BEGIN` ... `COMMIT`), and constraints for financial records (`payments`, `deposits`, `refunds`, `settlements`, `idempotency_keys`, `outbox`).
  - **NoSQL Document Store**: MongoDB (`payment_events` collection) for asynchronous webhook events, state transition history, and audit trails.
- **Monetary Precision**: Money is stored strictly as integer minor units (`paise` : 1 INR = 100 paise) internally to eliminate floating point rounding inaccuracies, and presented as decimal INR on external API surfaces.
- **Reliable Notification**: Outbox pattern with background worker retrying downstream Booking Service updates with exponential backoff and jitter.

---

## Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `4004` | Service HTTP port |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`) |
| `SQL_DB_PATH` | `./data/agrirent_payments.sqlite` | SQLite database file location |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/agrirent_payments` | MongoDB connection URI for events |
| `PAYMENT_GATEWAY` | `simulator` | Gateway adapter (`simulator`, `razorpay`) |
| `GATEWAY_WEBHOOK_SECRET` | `agrirent_webhook_secret_key_2026_dev` | Secret for HMAC-SHA256 signature verification |
| `BOOKING_SERVICE_URL` | `http://localhost:4002` | Downstream Booking Management Service URL |
| `IDENTITY_SERVICE_URL` | `http://localhost:4003` | Downstream Identity & KYC Service URL |
| `CLAIMS_SERVICE_URL` | `http://localhost:4005` | Downstream Claims Service URL (Service 6) |
| `INTERNAL_SERVICE_TOKEN` | `agrirent_internal_service_token_2026` | Service-to-service shared secret token |
| `JWT_SECRET` | `agrirent_super_secret_jwt_key_2026_dev` | Secret for verifying user JWT tokens |
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

# 3. Seed sample data
npm run seed

# 4. Run automated test suite (Jest + Supertest)
npm test

# 5. Start service in development mode
npm run dev

# 6. Start service in production mode
npm start
```

---

## Example `curl` Commands for Every Operation

### 1. Initiate Payment (`POST /v1/payments`)
```bash
curl -X POST http://localhost:4004/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RENTER_JWT>" \
  -H "Idempotency-Key: idemp-pay-1001" \
  -d '{
    "bookingId": "BK-1A2B3C4D",
    "rentalAmount": 3000.00,
    "deposit": 500.00
  }'
```

### 2. Verify Payment (`POST /v1/payments/:paymentId/verifications`)
```bash
curl -X POST http://localhost:4004/v1/payments/PAY-5E6F7A8B/verifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RENTER_JWT>" \
  -d '{
    "gatewayTransactionReference": "TXN-9F8E7D6C"
  }'
```

### 3. Get Payment Details (`GET /v1/payments/:paymentId`)
```bash
curl -X GET http://localhost:4004/v1/payments/PAY-5E6F7A8B \
  -H "Authorization: Bearer <RENTER_JWT>" \
  -H "Accept: application/json"
```

### 4. List Payments with Cursor Pagination (`GET /v1/payments`)
```bash
curl -X GET "http://localhost:4004/v1/payments?limit=10&status=CONFIRMED" \
  -H "Authorization: Bearer <RENTER_JWT>"
```

### 5. Check Payment Status (`GET /v1/bookings/:bookingId/payment-status`)
*(Invoked by Handover Service before machinery release)*
```bash
curl -X GET http://localhost:4004/v1/bookings/BK-1A2B3C4D/payment-status \
  -H "Accept: application/json"
```

### 6. Hold Security Deposit (`POST /v1/bookings/:bookingId/deposit-holds`)
```bash
curl -X POST http://localhost:4004/v1/bookings/BK-1A2B3C4D/deposit-holds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RENTER_JWT>" \
  -d '{
    "depositAmount": 500.00
  }'
```

### 7. Issue Refund (`POST /v1/payments/:paymentId/refunds`)
```bash
curl -X POST http://localhost:4004/v1/payments/PAY-5E6F7A8B/refunds \
  -H "Content-Type: application/json" \
  -H "internal_service_token: agrirent_internal_service_token_2026" \
  -H "Idempotency-Key: idemp-rfnd-1001" \
  -d '{
    "amount": 500.00,
    "reason": "Customer cancellation agreement"
  }'
```

### 8. Settle Booking (`POST /v1/bookings/:bookingId/settlements`)
```bash
curl -X POST http://localhost:4004/v1/bookings/BK-1A2B3C4D/settlements \
  -H "Content-Type: application/json" \
  -H "internal_service_token: agrirent_internal_service_token_2026" \
  -H "Idempotency-Key: idemp-set-1001" \
  -d '{
    "rentalAmount": 3000.00,
    "lateFine": 100.00,
    "damageDeduction": 200.00
  }'
```

### 9. Get Settlement Details (`GET /v1/bookings/:bookingId/settlements/:settlementId`)
```bash
curl -X GET http://localhost:4004/v1/bookings/BK-1A2B3C4D/settlements/SET-1A2B3C4D \
  -H "Authorization: Bearer <RENTER_JWT>" \
  -H "Accept: application/json"
```

### 10. Audit Event Log (`GET /v1/payments/:paymentId/events`)
```bash
curl -X GET "http://localhost:4004/v1/payments/PAY-5E6F7A8B/events?limit=10" \
  -H "Authorization: Bearer <RENTER_JWT>"
```

### 11. SOAP Call (`GetPaymentStatus`)
```bash
node scripts/soapClient.js BK-1A2B3C4D http://localhost:4004/soap/payments?wsdl
```
