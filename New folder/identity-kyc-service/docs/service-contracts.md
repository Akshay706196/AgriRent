# AgriRent — Identity & KYC Service Contracts

Formal SOA service contracts defining inter-service interfaces for Equipment and Booking services.

---

## Contract ID-01: GetUserEligibility
- **Service Name:** Identity and KYC Service
- **Operation:** `GetUserEligibility`
- **Endpoint:** `GET /api/v1/users/:userId/eligibility`
- **Authentication:** Service-to-Service Credentials (`x-service-client-id` + `x-service-client-secret`) or Bearer Service JWT.
- **Input Schema:** Path parameter `userId` (string, required).
- **Output Schema (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "userId": "USR-A1B2C3D4",
      "exists": true,
      "accountStatus": "ACTIVE",
      "kycStatus": "VERIFIED",
      "canRent": true,
      "canListEquipment": true
    }
  }
  ```
  If user is not found:
  ```json
  {
    "success": true,
    "data": {
      "userId": "USR-NONEXISTENT",
      "exists": false,
      "canRent": false,
      "canListEquipment": false
    }
  }
  ```
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing or invalid service credentials.
  - `403 FORBIDDEN`: Untrusted caller.
  - `500 INTERNAL_SERVER_ERROR`: Database failure.
- **Preconditions:** Caller is an authorized AgriRent microservice (Equipment Service or Booking Service).
- **Postconditions:** None (read-only query).
- **Dependencies:** None.
- **Idempotency:** Idempotent (safe GET).
