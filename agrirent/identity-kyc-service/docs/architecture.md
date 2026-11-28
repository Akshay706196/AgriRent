# AgriRent — Identity & KYC Service Architecture

## 1. Overview & Service Boundaries

The **Identity and KYC Service** (Service 1, default port `4003`) is the single source of truth for:
- User identities, authentication, and credentials.
- Security profiles, account statuses (`ACTIVE`, `SUSPENDED`, `BLOCKED`, `DEACTIVATED`).
- KYC document submission dossiers and verification lifecycles.
- Service-to-service eligibility assertions (`canRent`, `canListEquipment`).
- Security auditing and access tracing.

```
                           +----------------------------------------+
                           |          Client / Web App              |
                           +----------------------------------------+
                                        | (JWT Auth)
                                        v
+-------------------------------+  HTTP Contract +-------------------------------+
|  Equipment Management Service | -------------> |   Identity & KYC Service      |
|         (Port: 4001)          |  (Eligibility) |         (Port: 4003)          |
+-------------------------------+                +-------------------------------+
                                                        |
+-------------------------------+  HTTP Contract        | (Mongoose ODM)
|   Booking Management Service  | ------------->        v
|         (Port: 4002)          |  (Eligibility) +-------------------------------+
+-------------------------------+                |       agrirent_identity       |
                                                 |         (MongoDB DB)          |
                                                 +-------------------------------+
```

---

## 2. Loose-Coupling Rules

1. **Independent Database:** Stores identity data in `agrirent_identity`. It never connects to `agrirent_equipment` or `agrirent_bookings`.
2. **Zero Internal Imports:** Does not import code, models, or configurations from any other AgriRent service.
3. **Decoupled User Identity:** A single user identity can act as both equipment renter and equipment owner. No separate account types exist.
4. **Service Contracts:** Other services query user eligibility over REST (`GET /api/v1/users/:userId/eligibility`) using authenticated service credentials (`x-service-client-id`, `x-service-client-secret`) without needing direct database access.
5. **No Document Exposure:** Raw documents are never stored in the database or returned over public APIs; only secure object storage tokens/references are tracked.

---

## 3. Account Lifecycle & Security Gates

### 3.1 Account Statuses
- `ACTIVE`: Regular operational status. Can log in and perform actions subject to KYC.
- `SUSPENDED`: Temporarily restricted by admin pending review. Cannot log in or initiate rentals.
- `BLOCKED`: Revoked due to verified policy infractions. All operations disabled.
- `DEACTIVATED`: Voluntarily closed by user or terminal administrative action.

### 3.2 Eligibility Assertion Logic
The eligibility contract encapsulates all platform business rules:
- `canRent = (exists && accountStatus === 'ACTIVE' && kycStatus === 'VERIFIED')`
- `canListEquipment = (exists && accountStatus === 'ACTIVE' && kycStatus === 'VERIFIED')`

Neither Equipment Service nor Booking Service needs to re-implement KYC or suspension logic. They consume this stable assertion contract.
