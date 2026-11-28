# AgriRent — Booking Management Microservice

The **Booking Management Service** handles the peer-to-peer agricultural equipment rental lifecycle: rental requests, server-side price snapshots, concurrency-safe reservation locking, owner approvals/rejections, cancellations, and background 24-hour expiry.

## 1. Key Architectural Features
- **Strict Loose Coupling:** Does not share databases or internal models with Equipment Service. Fetches machine specifications dynamically via `equipment.client.js`.
- **Half-Open Date Interval Convention:** Treats `startDate` as inclusive and `endDate` as exclusive: `[startDate, endDate)`.
- **Date Overlap Prevention:**
  $$\text{existing.startDate} < \text{requested.endDate} \quad \text{AND} \quad \text{existing.endDate} > \text{requested.startDate}$$
- **Concurrency-Safe Reservation Mutex:** Uses atomic MongoDB reservation locks (`ReservationLock`) to serialize competing requests and prevent race-condition double bookings.
- **Authoritative Server Pricing:** Snapshot calculation captures price per day, 3% marketplace platform fee, and security deposit in INR.
- **24-Hour Expiry Engine:** Scheduled background worker (`expireBookings.job.js`) automatically expires pending bookings when the owner fails to respond within 24 hours. Synchronous guards prevent stale approvals.
- **Idempotency Protection:** Optional `Idempotency-Key` header ensures retried network requests return the existing booking without double charging or duplicate record creation.

---

## 2. Environment Variables

Create `.env` based on `.env.example`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP Port | `4002` |
| `NODE_ENV` | Environment (`development`, `test`, `production`) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/agrirent_bookings` |
| `JWT_SECRET` | Secret key for verifying JWT signatures | `agrirent_super_secret_jwt_key_2026_dev` |
| `EQUIPMENT_SERVICE_URL` | Base URL of Equipment Service | `http://localhost:4001` |
| `EQUIPMENT_SERVICE_TIMEOUT_MS` | HTTP timeout for Equipment Service calls | `5000` |
| `EXPIRY_JOB_CRON` | Cron pattern for 24h expiry worker | `*/5 * * * *` |
| `MOCK_AUTH` | Enable dev headers (`x-user-id`, etc.) | `false` |

---

## 3. Installation & Run Commands

```bash
# Navigate to service directory
cd booking-service

# Install dependencies
npm install

# Start in development mode (with nodemon)
npm run dev

# Start in production mode
npm start

# Run automated tests
npm test
```

---

## 4. API Endpoints Reference

### Health Check
- `GET /health`: Health status.

### Booking Endpoints (`/api/v1/bookings`)
- `POST /api/v1/bookings`: Request new rental booking (Renter JWT + KYC Verified).
- `GET /api/v1/bookings/availability`: Check dates availability for equipment (Public).
- `GET /api/v1/bookings/my-bookings`: Get bookings made by the authenticated renter.
- `GET /api/v1/bookings/owner/requests`: Get incoming booking requests for owner's equipment.
- `GET /api/v1/bookings/:bookingId`: Get booking details (Authorized participants only).
- `PATCH /api/v1/bookings/:bookingId/approve`: Owner approves booking request.
- `PATCH /api/v1/bookings/:bookingId/reject`: Owner rejects booking request.
- `PATCH /api/v1/bookings/:bookingId/cancel`: Cancel eligible booking (Renter or Owner).

---

## 5. Sample Requests

### Request Booking
```bash
curl -X POST http://localhost:4002/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RENTER_TOKEN>" \
  -d '{
    "equipmentId": "EQ-A1B2C3D4",
    "startDate": "2026-11-01",
    "endDate": "2026-11-03"
  }'
```

### Approve Booking (Owner)
```bash
curl -X PATCH http://localhost:4002/api/v1/bookings/BK-12345678/approve \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

### Check Availability
```bash
curl "http://localhost:4002/api/v1/bookings/availability?equipmentId=EQ-A1B2C3D4&startDate=2026-11-01&endDate=2026-11-03"
```
