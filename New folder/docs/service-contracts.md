# AgriRent — Service Contracts Specification

This document defines the formal SOA service contracts for AgriRent in accordance with the common service contract template.

---

## 1. Service Overview & Interaction Matrix

| Calling Service | Target Service | Contract / Operation | Data Exchanged | Expected Response / Failure Handling |
|---|---|---|---|---|
| Identity & KYC | Equipment | GetUserStatus | `ownerId` | Allow listing only for active, verified owners; otherwise reject |
| Identity & KYC | Booking | GetUserStatus | `renterId`, `ownerId` | Reject booking actions for blocked or unverified users |
| Equipment | Identity & KYC | GetUserStatus | `ownerId` | Prevent unauthorized equipment listings |
| Equipment | Booking | CheckActiveBookings | `equipmentId` | Prevent equipment deletion/deactivation if active bookings exist |
| Equipment | Booking | CheckAvailability | `equipmentId`, `startDate`, `endDate` | Delegate availability calculation to Booking Service without maintaining duplicate state |
| Booking | Identity & KYC | GetUserStatus | `renterId`, `ownerId` | Validate both parties before booking creation or approval |
| Booking | Equipment | GetEquipmentDetails | `equipmentId` | Fetch equipment price snapshot and confirm ACTIVE status |
| Booking | Payment & Deposit | InitiatePayment | `bookingId`, amounts, idempotency key | Await payment confirmation before marking as PAID/IN_RENTAL |

---

## 2. Equipment Management Service Contracts

### Contract EQ-01: ListEquipment
- **Service Name:** Equipment Management Service
- **Operation:** `ListEquipment`
- **Endpoint:** `POST /api/v1/equipment`
- **Input Schema:**
  ```json
  {
    "name": "string (min: 2, max: 100, required)",
    "category": "string (enum: ['TRACTOR', 'HARVESTER', 'ROTAVATOR', 'SEEDER', 'OTHER'], required)",
    "description": "string (min: 10, max: 2000, required)",
    "brand": "string (optional)",
    "model": "string (optional)",
    "manufacturingYear": "integer (1900..currentYear+1, optional)",
    "condition": "string (enum: ['NEW', 'GOOD', 'FAIR'], required)",
    "photos": "array of URI strings (optional, default: [])",
    "pricePerDay": "number (> 0, required)",
    "securityDeposit": "number (>= 0, required)",
    "pickupAddress": {
      "address": "string (required)",
      "city": "string (required)",
      "state": "string (required)",
      "postalCode": "string (required)"
    },
    "location": {
      "type": "string (must be 'Point', optional)",
      "coordinates": "[longitude, latitude] (optional)"
    },
    "termsAndConditions": "string (optional)",
    "status": "string (enum: ['ACTIVE', 'DRAFT'], default: 'ACTIVE')"
  }
  ```
- **Output Schema (HTTP 201):**
  ```json
  {
    "equipmentId": "string (e.g. EQ-A1B2C3D4)",
    "ownerId": "string",
    "name": "string",
    "category": "string",
    "description": "string",
    "brand": "string",
    "model": "string",
    "manufacturingYear": 2022,
    "condition": "string",
    "photos": [],
    "pricePerDay": 2500,
    "securityDeposit": 5000,
    "pickupAddress": { ... },
    "status": "ACTIVE",
    "createdAt": "ISO8601 string",
    "updatedAt": "ISO8601 string"
  }
  ```
- **Errors:**
  - `400 INVALID_INPUT`: Malformed JSON or syntax failure.
  - `401 UNAUTHENTICATED`: Missing or invalid JWT.
  - `403 KYC_REQUIRED`: Owner account is unverified.
  - `422 VALIDATION_FAILED`: Business field rules violated.
  - `500 INTERNAL_SERVER_ERROR`: Database or unexpected error.
- **Authentication:** Bearer JWT required. `ownerId` derived strictly from authenticated token claims.
- **Preconditions:** Owner must be authenticated and KYC-verified.
- **Postconditions:** New equipment document stored in `agrirent_equipment`.
- **Dependencies:** Identity/KYC verification.
- **Idempotency:** Non-idempotent (creates new listing per request).

---

### Contract EQ-02: GetEquipmentDetails
- **Service Name:** Equipment Management Service
- **Operation:** `GetEquipmentDetails`
- **Endpoint:** `GET /api/v1/equipment/:equipmentId`
- **Input Schema:** URL parameter `equipmentId` (string).
- **Output Schema (HTTP 200):** Equipment document with pricing, owner ID, and status.
- **Errors:**
  - `404 EQUIPMENT_NOT_FOUND`: Equipment ID does not exist or is deleted.
- **Authentication:** Publicly readable (or authenticated).
- **Preconditions:** Equipment exists.
- **Postconditions:** None (read-only).
- **Dependencies:** None.
- **Idempotency:** Idempotent (safe GET).

---

### Contract EQ-03: UpdateEquipment
- **Service Name:** Equipment Management Service
- **Operation:** `UpdateEquipment`
- **Endpoint:** `PATCH /api/v1/equipment/:equipmentId`
- **Input Schema:** Subset of equipment fields (`name`, `description`, `pricePerDay`, `securityDeposit`, `status`, etc.).
- **Output Schema (HTTP 200):** Updated equipment listing.
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing token.
  - `403 NOT_EQUIPMENT_OWNER`: Requester is not the equipment owner.
  - `404 EQUIPMENT_NOT_FOUND`: Listing does not exist.
  - `409 EQUIPMENT_HAS_ACTIVE_BOOKINGS`: Price or status cannot be changed while active bookings exist.
- **Authentication:** Bearer JWT required. Must match `equipment.ownerId`.
- **Preconditions:** Equipment exists, caller is owner.
- **Postconditions:** Equipment fields updated.
- **Dependencies:** Booking Service (for checking active bookings if changing critical terms).
- **Idempotency:** Idempotent.

---

### Contract EQ-04: DeleteEquipment
- **Service Name:** Equipment Management Service
- **Operation:** `DeleteEquipment`
- **Endpoint:** `DELETE /api/v1/equipment/:equipmentId`
- **Input Schema:** URL parameter `equipmentId` (string).
- **Output Schema (HTTP 200):** `{ "message": "Equipment listing successfully deactivated", "equipmentId": "..." }`
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing token.
  - `403 NOT_EQUIPMENT_OWNER`: Requester is not owner.
  - `404 EQUIPMENT_NOT_FOUND`: Listing does not exist.
  - `409 EQUIPMENT_HAS_ACTIVE_BOOKINGS`: Equipment has pending or approved bookings.
- **Authentication:** Bearer JWT required.
- **Preconditions:** Equipment exists, caller is owner, no active reservations.
- **Postconditions:** Soft-deleted (`status = 'INACTIVE'`, `isDeleted = true`).
- **Dependencies:** Booking Service (`GET /api/v1/bookings?equipmentId=...&activeOnly=true`).
- **Idempotency:** Idempotent.

---

### Contract EQ-05: CheckEquipmentAvailability
- **Service Name:** Equipment Management Service
- **Operation:** `CheckAvailability`
- **Endpoint:** `GET /api/v1/equipment/:equipmentId/availability?startDate=...&endDate=...`
- **Input Schema:**
  - Query parameters: `startDate` (ISO YYYY-MM-DD), `endDate` (ISO YYYY-MM-DD).
- **Output Schema (HTTP 200):**
  ```json
  {
    "equipmentId": "EQ-201",
    "startDate": "2026-11-01",
    "endDate": "2026-11-03",
    "available": true
  }
  ```
- **Errors:**
  - `400 INVALID_DATE_RANGE`: `startDate >= endDate` or invalid format.
  - `404 EQUIPMENT_NOT_FOUND`: Equipment not found or not active.
  - `503 DEPENDENCY_UNAVAILABLE`: Booking Service unreachable.
- **Authentication:** Public.
- **Dependencies:** Booking Service (`GET /api/v1/bookings/availability`).
- **Idempotency:** Idempotent.

---

## 3. Booking Management Service Contracts

### Contract BK-01: RequestBooking
- **Service Name:** Booking Management Service
- **Operation:** `RequestBooking`
- **Endpoint:** `POST /api/v1/bookings`
- **Input Schema:**
  ```json
  {
    "equipmentId": "string (required)",
    "startDate": "string (YYYY-MM-DD, required)",
    "endDate": "string (YYYY-MM-DD, required)"
  }
  ```
- **Output Schema (HTTP 201):**
  ```json
  {
    "bookingId": "string (e.g. BK-9F8E7D6C)",
    "equipmentId": "string",
    "renterId": "string",
    "ownerId": "string",
    "startDate": "2026-11-01T00:00:00.000Z",
    "endDate": "2026-11-03T00:00:00.000Z",
    "rentalDays": 2,
    "pricePerDaySnapshot": 2500,
    "rentalAmount": 5000,
    "platformFee": 150,
    "securityDeposit": 5000,
    "totalAmount": 10150,
    "currency": "INR",
    "status": "PENDING_OWNER",
    "ownerResponseDeadline": "2026-10-13T22:00:00.000Z",
    "createdAt": "ISO8601 string"
  }
  ```
- **Errors:**
  - `400 INVALID_DATES`: `startDate >= endDate` or in the past.
  - `400 CANNOT_RENT_OWN_EQUIPMENT`: `renterId === equipment.ownerId`.
  - `403 KYC_REQUIRED`: Renter is not KYC-verified.
  - `404 EQUIPMENT_NOT_FOUND`: Equipment ID does not exist in Equipment Service.
  - `409 DATE_CONFLICT`: Conflicting reservation already exists for the equipment.
  - `422 EQUIPMENT_NOT_AVAILABLE`: Equipment listing is not in `ACTIVE` state.
  - `503 EQUIPMENT_SERVICE_UNAVAILABLE`: Cannot communicate with Equipment Service.
- **Authentication:** Bearer JWT required. `renterId` derived strictly from authenticated user.
- **Preconditions:** Valid dates, renter verified, equipment active, no date overlap.
- **Postconditions:** New booking created in `PENDING_OWNER` with snapshot financials and 24-hour deadline.
- **Dependencies:** Equipment Service (`GET /api/v1/equipment/:equipmentId`).
- **Idempotency:** Supported via optional `Idempotency-Key` header.

---

### Contract BK-02: ApproveBooking
- **Service Name:** Booking Management Service
- **Operation:** `ApproveBooking`
- **Endpoint:** `PATCH /api/v1/bookings/:bookingId/approve`
- **Input Schema:** URL parameter `bookingId` (string).
- **Output Schema (HTTP 200):**
  ```json
  {
    "bookingId": "BK-9F8E7D6C",
    "status": "APPROVED",
    "approvedAt": "ISO8601 string",
    "message": "Booking approved successfully"
  }
  ```
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing or invalid token.
  - `403 NOT_EQUIPMENT_OWNER`: Requester is not the equipment owner for this booking.
  - `404 BOOKING_NOT_FOUND`: Booking ID does not exist.
  - `409 BOOKING_EXPIRED`: 24-hour response deadline has elapsed.
  - `409 INVALID_STATE_TRANSITION`: Booking is not in `PENDING_OWNER` state.
- **Authentication:** Bearer JWT required.
- **Preconditions:** Booking is `PENDING_OWNER`, owner deadline has not elapsed, caller is owner.
- **Postconditions:** Status updated to `APPROVED`, `approvedAt` recorded.
- **Dependencies:** None.
- **Idempotency:** Idempotent (conditional update).

---

### Contract BK-03: RejectBooking
- **Service Name:** Booking Management Service
- **Operation:** `RejectBooking`
- **Endpoint:** `PATCH /api/v1/bookings/:bookingId/reject`
- **Input Schema:**
  ```json
  {
    "reason": "string (optional, max: 500)"
  }
  ```
- **Output Schema (HTTP 200):** Updated booking in `REJECTED` state with `rejectedAt` and `rejectionReason`.
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing token.
  - `403 NOT_EQUIPMENT_OWNER`: Requester is not the equipment owner.
  - `404 BOOKING_NOT_FOUND`: Booking does not exist.
  - `409 INVALID_STATE_TRANSITION`: Booking is not in `PENDING_OWNER` state.
- **Authentication:** Bearer JWT required.
- **Preconditions:** Booking is `PENDING_OWNER`, caller is owner.
- **Postconditions:** Status updated to `REJECTED`, dates freed.
- **Dependencies:** None.
- **Idempotency:** Idempotent.

---

### Contract BK-04: CancelBooking
- **Service Name:** Booking Management Service
- **Operation:** `CancelBooking`
- **Endpoint:** `PATCH /api/v1/bookings/:bookingId/cancel`
- **Input Schema:**
  ```json
  {
    "reason": "string (optional, max: 500)"
  }
  ```
- **Output Schema (HTTP 200):** Updated booking in `CANCELLED` state, with refund eligibility summary.
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing token.
  - `403 NOT_PARTICIPANT`: Caller is neither the renter nor the owner.
  - `404 BOOKING_NOT_FOUND`: Booking does not exist.
  - `409 CANCELLATION_NOT_ALLOWED`: Booking is already in `IN_RENTAL`, `RETURNED`, `COMPLETED`, or past cancellation window.
- **Authentication:** Bearer JWT required.
- **Preconditions:** Booking is `PENDING_OWNER` or `APPROVED` prior to rental start.
- **Postconditions:** Status updated to `CANCELLED`, dates freed.
- **Dependencies:** None.
- **Idempotency:** Idempotent.

---

### Contract BK-05: CheckBookingAvailability
- **Service Name:** Booking Management Service
- **Operation:** `CheckBookingAvailability`
- **Endpoint:** `GET /api/v1/bookings/availability`
- **Input Schema:**
  - Query parameters: `equipmentId` (required), `startDate` (required, ISO date), `endDate` (required, ISO date).
- **Output Schema (HTTP 200):**
  ```json
  {
    "equipmentId": "EQ-201",
    "startDate": "2026-11-01",
    "endDate": "2026-11-03",
    "available": true,
    "conflictingBookingsCount": 0
  }
  ```
- **Errors:**
  - `400 INVALID_DATES`: `startDate >= endDate`.
- **Authentication:** Public or service-to-service.
- **Preconditions:** Valid query parameters.
- **Postconditions:** None (read-only query against active reserving states).
- **Dependencies:** None.
- **Idempotency:** Idempotent.
