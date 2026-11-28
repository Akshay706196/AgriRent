# AgriRent — Peer-to-Peer Agricultural Equipment Rental Microservices

AgriRent is a peer-to-peer agricultural equipment rental marketplace where farmers can list, search, and rent agricultural machinery such as tractors, harvesters, rotavators, seed drills, and other farming equipment.

This repository provides two independent, loosely coupled backend microservices built in accordance with **Service-Oriented Architecture (SOA)** and the **Database-per-Service** pattern:
1. **Equipment Management Service** (Default Port: `4001`, Database: `agrirent_equipment`)
2. **Booking Management Service** (Default Port: `4002`, Database: `agrirent_bookings`)

---

## 1. Architectural Highlights

```
                          +------------------------------------------+
                          |        API Gateway / HTTP Clients        |
                          +------------------------------------------+
                                         |            |
                               (Port 4001)            (Port 4002)
                                         |            |
                                         v            v
+-------------------------------+              +-------------------------------+
|  Equipment Management Service |  HTTP REST   |   Booking Management Service  |
|         (Port: 4001)          | <----------> |          (Port: 4002)         |
+-------------------------------+  Contracts   +-------------------------------+
               |                                               |
         (Mongoose ODM)                                  (Mongoose ODM)
               v                                               v
+-------------------------------+              +-------------------------------+
|     agrirent_equipment        |              |       agrirent_bookings       |
|       (MongoDB DB)            |              |         (MongoDB DB)          |
+-------------------------------+              +-------------------------------+
```

- **Independent Databases:** Neither service has access to the other's database or imports internal models, controllers, or database configurations.
- **REST Inter-Service Communication:** Booking Service consumes Equipment Service APIs through a resilient HTTP client (`equipment.client.js`) featuring configurable timeouts, bounded retries with backoff for idempotent calls, and detailed correlation tracing.
- **Strict Single Source of Truth:**
  - Equipment Service owns equipment listings, specifications, and pricing configurations.
  - Booking Service owns the booking lifecycle, price snapshots, and authoritative date availability calculations.
- **Concurrency-Safe Reservation Locking:** Implements an atomic MongoDB mutex (`ReservationLock`) to serialize competing booking requests for the same machinery, preventing double bookings.
- **Half-Open Date Interval Convention:** Uses $[startDate, endDate)$ (start date inclusive, end date exclusive). Two bookings conflict if and only if:
  $$\text{existing.startDate} < \text{requested.endDate} \quad \text{AND} \quad \text{existing.endDate} > \text{requested.startDate}$$
- **Automatic 24-Hour Expiry Engine:** Scheduled background worker (`expireBookings.job.js`) automatically transitions unresponded pending booking requests to `EXPIRED`. Synchronous guards also enforce the deadline on approval endpoints.
- **Server-Side Pricing Engine:** Computes rental days, rental fee, 3% marketplace platform fee, and security deposit snapshot strictly on the server.
- **Idempotency Protection:** Honors `Idempotency-Key` headers on booking requests to prevent duplicate transactions on network retries.
- **KYC & JWT Authentication:** Enforces JWT-based claims with verified KYC gate (`403 KYC_REQUIRED`) on machinery listings and bookings.

---

## 2. Repository Structure

```text
AgriRentt/
├── equipment-service/
│   ├── src/
│   │   ├── config/database.js             # Dedicated MongoDB connection
│   │   ├── models/Equipment.js            # Equipment Mongoose model & indexes
│   │   ├── controllers/equipment.controller.js
│   │   ├── services/equipment.service.js  # Business logic & booking queries
│   │   ├── routes/equipment.routes.js
│   │   ├── validators/equipment.validator.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js         # JWT & KYC enforcement
│   │   │   ├── error.middleware.js        # Standardized error response
│   │   │   └── notFound.middleware.js
│   │   ├── utils/
│   │   │   ├── ApiError.js
│   │   │   └── asyncHandler.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   └── equipment.test.js              # Comprehensive Jest/Supertest suite
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
│
├── booking-service/
│   ├── src/
│   │   ├── config/database.js             # Dedicated MongoDB connection
│   │   ├── models/
│   │   │   ├── Booking.js                 # Booking Mongoose model & indexes
│   │   │   └── ReservationLock.js         # Atomic concurrency mutex
│   │   ├── controllers/booking.controller.js
│   │   ├── services/
│   │   │   ├── booking.service.js         # Pricing, reservations, approvals
│   │   │   └── equipment.client.js        # Resilient HTTP client for Service A
│   │   ├── routes/booking.routes.js
│   │   ├── validators/booking.validator.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   └── notFound.middleware.js
│   │   ├── utils/
│   │   │   ├── ApiError.js
│   │   │   └── asyncHandler.js
│   │   ├── jobs/
│   │   │   └── expireBookings.job.js      # Background 24-hour expiry cron worker
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   └── booking.test.js                # Concurrency, pricing & lifecycle tests
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
│
├── docs/
│   ├── architecture.md                    # Deep-dive architectural documentation
│   ├── service-contracts.md               # SOA service contracts (SOA format)
│   ├── equipment-api.yaml                 # OpenAPI 3.0 specification for Service A
│   └── booking-api.yaml                   # OpenAPI 3.0 specification for Service B
│
├── package.json                           # Root convenience script runner
├── .gitignore
└── README.md
```

---

## 3. Quick Start & Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended; developed and tested on v24)
- npm (v9 or higher)
- MongoDB instance (MongoDB 6+ or MongoDB Atlas) running locally or remotely (automated tests run self-contained in-memory via `mongodb-memory-server`)

### Step 1: Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or navigate into each service folder and run `npm install`)*

### Step 2: Environment Configuration
Copy `.env.example` in both services:

**For Equipment Service (`equipment-service/.env`):**
```env
PORT=4001
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/agrirent_equipment
JWT_SECRET=agrirent_super_secret_jwt_key_2026_dev
BOOKING_SERVICE_URL=http://localhost:4002
MOCK_AUTH=false
```

**For Booking Service (`booking-service/.env`):**
```env
PORT=4002
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/agrirent_bookings
JWT_SECRET=agrirent_super_secret_jwt_key_2026_dev
EQUIPMENT_SERVICE_URL=http://localhost:4001
EQUIPMENT_SERVICE_TIMEOUT_MS=5000
EXPIRY_JOB_CRON=*/5 * * * *
MOCK_AUTH=false
```

---

## 4. Running the Microservices Locally in VS Code

You can open two terminal panes in VS Code:

### Terminal 1 — Equipment Management Service
```powershell
cd equipment-service
npm run dev
```
*Output: Running on http://localhost:4001*

### Terminal 2 — Booking Management Service
```powershell
cd booking-service
npm run dev
```
*Output: Running on http://localhost:4002*

---

## 5. Running Automated Tests

Both microservices include automated test suites powered by Jest, Supertest, and isolated in-memory MongoDB servers:

### Run All Tests Across Both Microservices:
```powershell
npm test
```

### Run Tests Individually:
```powershell
# Equipment Service tests (14 tests)
npm run test:equipment

# Booking Service tests (17 tests)
npm run test:booking
```

---

## 6. End-to-End Manual Testing Sequence

Follow this step-by-step cURL sequence to verify the end-to-end business workflow across both microservices.

### Step 6.1: Generate Test JWT Tokens
Run the following one-line command to generate valid JWT tokens for testing:

```powershell
node -e "const jwt = require('./equipment-service/node_modules/jsonwebtoken'); const secret = 'agrirent_super_secret_jwt_key_2026_dev'; console.log('OWNER_TOKEN:\n' + jwt.sign({ sub: 'USR_OWNER_1', role: 'OWNER', kycStatus: 'VERIFIED' }, secret)); console.log('\nRENTER_TOKEN:\n' + jwt.sign({ sub: 'USR_RENTER_1', role: 'USER', kycStatus: 'VERIFIED' }, secret));"
```

Save the output as `$OWNER_TOKEN` and `$RENTER_TOKEN`.

---

### Step 6.2: Create Equipment Listing (Equipment Service, Port 4001)

```bash
curl -X POST http://localhost:4001/api/v1/equipment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{
    "name": "Mahindra 575 DI Tractor",
    "category": "TRACTOR",
    "description": "45 HP agricultural tractor with dual clutch and power steering",
    "brand": "Mahindra",
    "model": "575 DI",
    "manufacturingYear": 2022,
    "condition": "GOOD",
    "photos": ["https://images.example.com/tractor.jpg"],
    "pricePerDay": 2500,
    "securityDeposit": 5000,
    "pickupAddress": {
      "address": "Village Agro Center, Plot 9",
      "city": "Gandhinagar",
      "state": "Gujarat",
      "postalCode": "382010"
    },
    "status": "ACTIVE"
  }'
```
**Expected Response (HTTP 201 Created):**
```json
{
  "equipmentId": "EQ-XXXXXXXX",
  "ownerId": "USR_OWNER_1",
  "name": "Mahindra 575 DI Tractor",
  "pricePerDay": 2500,
  "securityDeposit": 5000,
  "status": "ACTIVE"
}
```
*(Copy the generated `equipmentId`, e.g. `EQ-XXXXXXXX`)*

---

### Step 6.3: Search Available Equipment (Equipment Service, Port 4001)

```bash
curl "http://localhost:4001/api/v1/equipment?category=TRACTOR&city=Gandhinagar&minPrice=1000&maxPrice=3000&page=1&limit=10"
```
**Expected Response (HTTP 200 OK):** Returns paginated equipment matching the filters.

---

### Step 6.4: Request a Booking (Booking Service, Port 4002)

The renter requests equipment `EQ-XXXXXXXX` for Nov 1, 2026 to Nov 3, 2026 (2 days).

```bash
curl -X POST http://localhost:4002/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RENTER_TOKEN>" \
  -d '{
    "equipmentId": "EQ-XXXXXXXX",
    "startDate": "2026-11-01",
    "endDate": "2026-11-03"
  }'
```
**Expected Response (HTTP 201 Created):**
```json
{
  "bookingId": "BK-YYYYYYYY",
  "equipmentId": "EQ-XXXXXXXX",
  "renterId": "USR_RENTER_1",
  "ownerId": "USR_OWNER_1",
  "rentalDays": 2,
  "pricePerDaySnapshot": 2500,
  "rentalAmount": 5000,
  "platformFee": 150,
  "securityDeposit": 5000,
  "totalAmount": 10150,
  "status": "PENDING_OWNER",
  "ownerResponseDeadline": "2026-10-13T...Z"
}
```

---

### Step 6.5: Verify Date Overlap Prevention (409 DATE_CONFLICT)

Attempt to book the same equipment on overlapping dates (e.g., Nov 2 to Nov 4):

```bash
curl -X POST http://localhost:4002/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RENTER_TOKEN>" \
  -d '{
    "equipmentId": "EQ-XXXXXXXX",
    "startDate": "2026-11-02",
    "endDate": "2026-11-04"
  }'
```
**Expected Response (HTTP 409 Conflict):**
```json
{
  "error": {
    "code": "DATE_CONFLICT",
    "message": "Equipment is already reserved or booked for the selected dates.",
    "correlationId": "req-..."
  }
}
```

---

### Step 6.6: Owner Approves the Booking (Booking Service, Port 4002)

```bash
curl -X PATCH http://localhost:4002/api/v1/bookings/BK-YYYYYYYY/approve \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```
**Expected Response (HTTP 200 OK):**
```json
{
  "bookingId": "BK-YYYYYYYY",
  "status": "APPROVED",
  "approvedAt": "2026-10-12T...Z"
}
```

---

### Step 6.7: Check Availability API (Booking Service, Port 4002)

Query availability for the reserved period:
```bash
curl "http://localhost:4002/api/v1/bookings/availability?equipmentId=EQ-XXXXXXXX&startDate=2026-11-01&endDate=2026-11-03"
```
**Response:** `{"equipmentId":"EQ-XXXXXXXX","available":false,"conflictingBookingsCount":1}`

Query availability for adjacent non-overlapping period (Nov 3 to Nov 5):
```bash
curl "http://localhost:4002/api/v1/bookings/availability?equipmentId=EQ-XXXXXXXX&startDate=2026-11-03&endDate=2026-11-05"
```
**Response:** `{"equipmentId":"EQ-XXXXXXXX","available":true,"conflictingBookingsCount":0}`

---

## 7. Standard API Error Code Reference

| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `INVALID_INPUT` / `INVALID_DATES` | Malformed JSON or invalid date boundaries |
| `400` | `CANNOT_RENT_OWN_EQUIPMENT` | Owner attempting to rent their own machine |
| `401` | `UNAUTHENTICATED` / `INVALID_TOKEN` | Missing or invalid Bearer JWT token |
| `403` | `KYC_REQUIRED` | Account has not completed KYC verification |
| `403` | `NOT_EQUIPMENT_OWNER` | Requester is not the owner of the equipment |
| `403` | `ACCESS_DENIED` | Requester is not authorized to access the resource |
| `404` | `EQUIPMENT_NOT_FOUND` / `BOOKING_NOT_FOUND` | Resource identifier does not exist |
| `409` | `DATE_CONFLICT` | Overlapping booking reservation detected |
| `409` | `BOOKING_EXPIRED` | 24-hour owner approval window has elapsed |
| `409` | `EQUIPMENT_HAS_ACTIVE_BOOKINGS` | Cannot delete equipment with pending/approved rentals |
| `409` | `INVALID_STATE_TRANSITION` | Attempted illegal lifecycle transition |
| `422` | `VALIDATION_FAILED` | Field level validation failure |
| `422` | `EQUIPMENT_NOT_AVAILABLE` | Machinery listing is not in `ACTIVE` state |
| `503` | `EQUIPMENT_SERVICE_UNAVAILABLE` | Downstream Equipment Service unreachable |
| `503` | `DEPENDENCY_UNAVAILABLE` | Downstream Booking Service unreachable |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server error |

---

## 8. OpenAPI / Swagger Documentation

Formal OpenAPI 3.0 schemas are available in the `docs/` directory:
- **Equipment Management Service:** [`docs/equipment-api.yaml`](docs/equipment-api.yaml)
- **Booking Management Service:** [`docs/booking-api.yaml`](docs/booking-api.yaml)
- **SOA Architecture Details:** [`docs/architecture.md`](docs/architecture.md)
- **SOA Inter-Service Contracts:** [`docs/service-contracts.md`](docs/service-contracts.md)
