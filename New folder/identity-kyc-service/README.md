# AgriRent — Service 1: Identity and KYC Microservice

The **Identity and KYC Management Service** (Port: `4003`, Database: `agrirent_identity`) is the authoritative security boundary and identity provider for the AgriRent agricultural equipment rental ecosystem.

It manages user registrations, credential authentication, JWT token issuance, user profiles, KYC document dossiers, administrative reviews, account lifecycle states (`ACTIVE`, `SUSPENDED`, `BLOCKED`, `DEACTIVATED`), security audit logging, and service-to-service eligibility assertions.

---

## 1. Key Architectural Features

- **Strict Microservice Isolation:** Operates its own dedicated database (`agrirent_identity`). Never accesses Equipment or Booking databases.
- **Unified Account Model:** A single user account can act as both equipment renter and equipment owner.
- **Authoritative KYC State Machine:** Enforces valid transitions (`NOT_SUBMITTED` $\to$ `PENDING` $\to$ `UNDER_REVIEW` $\to$ `VERIFIED` / `REJECTED` $\to$ `RESUBMISSION_REQUIRED`).
- **Administrative Integrity & Self-Verification Prevention:** Administrators are barred from approving their own KYC applications or self-escalating permissions.
- **Service-to-Service Eligibility Contract:** Exposes `GET /api/v1/users/:userId/eligibility` protected by service credentials (`x-service-client-id`, `x-service-client-secret`) so Equipment and Booking services can verify renter and owner eligibility over REST without direct database dependencies.
- **Security & Privacy by Design:** Passwords hashed with `bcryptjs` (salt rounds 10), normalized emails and phones, rate-limited auth endpoints, and raw storage references shielded from non-administrative endpoints.

---

## 2. Environment Variables

Create `.env` based on `.env.example`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP Service Port | `4003` |
| `NODE_ENV` | Environment (`development`, `test`, `production`) | `development` |
| `MONGODB_URI` | MongoDB Connection URI | `mongodb://127.0.0.1:27017/agrirent_identity` |
| `JWT_SECRET` | Secret key for signing/verifying JWTs | `agrirent_super_secret_jwt_key_2026_dev` |
| `JWT_ISSUER` | JWT token issuer claim | `agrirent-identity` |
| `JWT_AUDIENCE` | JWT token audience claim | `agrirent-services` |
| `JWT_ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime in seconds | `900` (15 minutes) |
| `IDENTITY_SERVICE_CLIENT_ID` | Inter-service authentication client ID | `agrirent_internal_client` |
| `IDENTITY_SERVICE_CLIENT_SECRET` | Inter-service authentication client secret | `agrirent_internal_secret_key_2026` |
| `ADMIN_BOOTSTRAP_ENABLED` | Automatically bootstrap default administrator | `true` |
| `ADMIN_BOOTSTRAP_EMAIL` | Default administrator email | `admin@agrirent.internal` |
| `ADMIN_BOOTSTRAP_PASSWORD` | Default administrator password | `AdminStrongPass123!` |

---

## 3. Installation & Run Commands

```bash
# Navigate to identity service directory
cd identity-kyc-service

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

### Authentication Endpoints (`/api/v1/auth`)
- `POST /api/v1/auth/register`: Register a new user (`name`, `email`, `phone`, `password`).
- `POST /api/v1/auth/login`: Authenticate via email/phone and obtain JWT access token.
- `GET /api/v1/auth/me`: Get current authenticated user profile.
- `PATCH /api/v1/auth/change-password`: Change user password securely.

### User Profile & Eligibility Endpoints (`/api/v1/users`)
- `GET /api/v1/users/me`: Get own profile details.
- `PATCH /api/v1/users/me`: Update permitted profile fields (`name`, `phone`).
- `GET /api/v1/users/:userId/eligibility`: Service-to-service eligibility assertion contract.

### KYC Verification Endpoints (`/api/v1/kyc`)
- `POST /api/v1/kyc/submit`: Submit KYC identity verification documents.
- `GET /api/v1/kyc/me`: Get own current KYC status.
- `GET /api/v1/kyc/me/history`: Get own KYC submission history.
- `GET /api/v1/kyc/admin/pending`: List pending KYC submissions (Admin only).
- `GET /api/v1/kyc/admin/:kycId`: View submission details (Admin only).
- `PATCH /api/v1/kyc/admin/:kycId/approve`: Approve KYC submission (Admin only).
- `PATCH /api/v1/kyc/admin/:kycId/reject`: Reject KYC submission (Admin only).

### Administrator Account Management Endpoints (`/api/v1/admin`)
- `GET /api/v1/admin/users/:userId`: View user account details and audit history.
- `PATCH /api/v1/admin/users/:userId/suspend`: Suspend a user account.
- `PATCH /api/v1/admin/users/:userId/block`: Block a user account.
- `PATCH /api/v1/admin/users/:userId/restore`: Restore account to ACTIVE.

---

## 5. End-to-End Verification Walkthrough

Follow this step-by-step cURL sequence to verify the end-to-end identity and KYC lifecycle.

### Step 5.1: Register a Normal User
```bash
curl -X POST http://localhost:4003/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "phone": "+919876543210",
    "password": "ExampleStrongPassword123!"
  }'
```
*Returns `HTTP 201 Created` with `userId` (e.g. `USR-101`), `accountStatus: "ACTIVE"`, `kycStatus: "NOT_SUBMITTED"`.*

---

### Step 5.2: User Logs In & Acquires JWT Access Token
```bash
curl -X POST http://localhost:4003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "ravi@example.com",
    "password": "ExampleStrongPassword123!"
  }'
```
*Returns `HTTP 200 OK` with `accessToken`. Save this as `$USER_TOKEN`.*

---

### Step 5.3: Check Initial Eligibility (Prior to KYC)
Equipment or Booking service calls the eligibility endpoint:
```bash
curl -X GET http://localhost:4003/api/v1/users/USR-101/eligibility \
  -H "x-service-client-id: agrirent_internal_client" \
  -H "x-service-client-secret: agrirent_internal_secret_key_2026"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "USR-101",
    "exists": true,
    "accountStatus": "ACTIVE",
    "kycStatus": "NOT_SUBMITTED",
    "canRent": false,
    "canListEquipment": false
  }
}
```

---

### Step 5.4: User Submits KYC Document
```bash
curl -X POST http://localhost:4003/api/v1/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{
    "documentType": "GOVERNMENT_ID",
    "documentReference": "storage://secure-kyc-docs/ravi-gov-id.pdf"
  }'
```
*Returns `HTTP 201 Created` with generated `kycId` (e.g. `KYC-201`) and `status: "PENDING"`.*

---

### Step 5.5: Administrator Logs In
```bash
curl -X POST http://localhost:4003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@agrirent.internal",
    "password": "AdminStrongPass123!"
  }'
```
*Returns `accessToken` for administrator. Save as `$ADMIN_TOKEN`.*

---

### Step 5.6: Administrator Approves the KYC Submission
```bash
curl -X PATCH http://localhost:4003/api/v1/kyc/admin/KYC-201/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "decisionNote": "Government ID verified and matched"
  }'
```
*Returns `HTTP 200 OK` with `status: "VERIFIED"`.*

---

### Step 5.7: Verify User is Now Eligible
```bash
curl -X GET http://localhost:4003/api/v1/users/USR-101/eligibility \
  -H "x-service-client-id: agrirent_internal_client" \
  -H "x-service-client-secret: agrirent_internal_secret_key_2026"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "USR-101",
    "exists": true,
    "accountStatus": "ACTIVE",
    "kycStatus": "VERIFIED",
    "canRent": true,
    "canListEquipment": true
  }
}
```

---

### Step 5.8: Suspend Account & Confirm Immediate Ineligibility
```bash
curl -X PATCH http://localhost:4003/api/v1/admin/users/USR-101/suspend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "reason": "Temporary verification check"
  }'
```

Query eligibility again:
```bash
curl -X GET http://localhost:4003/api/v1/users/USR-101/eligibility \
  -H "x-service-client-id: agrirent_internal_client" \
  -H "x-service-client-secret: agrirent_internal_secret_key_2026"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "USR-101",
    "exists": true,
    "accountStatus": "SUSPENDED",
    "kycStatus": "VERIFIED",
    "canRent": false,
    "canListEquipment": false
  }
}
```
*(User is immediately barred from renting or listing machinery while suspended).*
