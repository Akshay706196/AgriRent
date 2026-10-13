# CS543 Assignment 4 — AgriRent Booking Service

**Student name:** Sundram Tripathi  
**Roll No.:** 20251651091  
**Team ID:** 04  
**Team members:** Sundram Tripathi (20251651091, Lead), Akshay Kumar (20251651012), Abhinav Kumar Chandravanshi (20251651004), Ankit Kumar (20251651022)

> This is an Assignment 4 adaptation for the existing AgriRent project. The selected service is **Booking**, not Payments. The implementation is a runnable teaching prototype using in-process storage; it is not yet production persistence or a production deployment.

## A1–A4. Service choice, SOAP-style starting operations and REST resource table

Chosen service: **Booking Service**. It owns booking-request records and their lifecycle state. Equipment details remain owned by Equipment Catalogue; the booking service asks that service to verify an equipment ID through an HTTP call and does not import its store.

Starting SOAP-style operations (verbs are intentionally removed from the final URLs):
- `createBooking(equipmentId, renterId, startDate, endDate)`
- `getBooking(bookingId)`
- `listBookings(status)`
- `cancelBooking(bookingId, reason)`

| Method | URL | What it does | Success code | Failure codes |
|---|---|---|---|---|
| POST | `/bookings` | Create a booking request, initially pending owner approval | 201 + `Location` | 400, 422, 503 |
| GET | `/bookings/{id}` | Read one booking | 200 | 404 |
| GET | `/bookings?status=PENDING_OWNER_APPROVAL` | List bookings, optionally filtered by status | 200 | 400 |
| POST | `/bookings/{id}/cancellation` | Cancel a pending booking using a sub-resource | 200 | 400, 404, 409 |
| GET | `/health` | Health check | 200 | — |

## A5. Hard resource-design choice

Cancellation is an action, so putting `cancel` directly in the URL would preserve a procedure-shaped API rather than model a resource. I represented the cancellation request as the `/bookings/{id}/cancellation` sub-resource and used `POST` because it creates a state-changing cancellation event. I rejected `GET /cancelBooking?id=...` because GET should not change state and can be cached or prefetched by clients.

## C. Implementation choices

- `models.js`: record model, public `as_json()` representation, and body validation.
- `store.js`: in-process dictionary-like storage; it is private to this service.
- `errors.js`: one `problem()` helper emits `type`, `title`, `status`, and `detail` for failures.
- `app.js`: Express endpoints and status codes.
- `dependency.js`: outbound Equipment Catalogue GET with timeout, exponential backoff and jitter. Only safe GET calls are retried; 4xx responses are not retried.
- `tests/app.test.js`: automated tests for create + Location, idempotent repeat, malformed request, unknown ID, state conflict and domain rejection.

Create requests require an `Idempotency-Key` header. Repeating the same key returns the original public booking representation and does not call the equipment service again. The record stores the key internally, but `as_json()` does not expose it.

## D. Dependency fallback decision

If Equipment Catalogue cannot be reached after the bounded retries, Booking returns `503 Service Unavailable` and `Retry-After: 2`, and does not create a booking. It would be unsafe to degrade by accepting a booking without verifying that the equipment exists and is available, because that could create an unfulfillable rental. A caller can retry with the same idempotency key when the dependency recovers.

## Required comparisons with Assignment 3

### 1. WSDL vs OpenAPI line count

At the time this note was prepared, `partner.wsdl` from Assignment 3 has **114 lines** and this `openapi.yaml` has **201 lines**, a difference of **87 lines** (counted with `wc -l`). The difference is not a measure of protocol power: this OpenAPI file documents multiple REST paths, reusable JSON schemas, parameters and HTTP status responses, whereas the WSDL describes the `authorizeEscrowHold` SOAP payment operation. WSDL explicitly declares SOAP binding/transport and a service/port endpoint; this REST contract does not need SOAP binding declarations or a SOAP port declaration. Counts may change if either file is edited.

### 2. SOAP fault mapped to HTTP problem response

Assignment 3 `soap-fault.xml` contains:

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:esc="http://escrow.agripay.bank.in/ws/escrow">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>soapenv:Client</faultcode>
      <faultstring>Escrow authorization failed: Payer instrument has insufficient credit limit</faultstring>
      <detail>
        <esc:EscrowFaultDetail>
          <esc:PartnerErrorCode>BANK_INSUFFICIENT_FUNDS</esc:PartnerErrorCode>
          <esc:ErrorDescription>The requested escrow amount INR 12500.00 exceeds payer account limit</esc:ErrorDescription>
        </esc:EscrowFaultDetail>
      </detail>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>
```

In the payment API, that partner-specific fault (`BANK_INSUFFICIENT_FUNDS`) maps to the AgriRent contract error `PAYMENT_DECLINED` (the Assignment 3 mapping). In this Booking REST service, the comparable domain rejection is represented using an HTTP error status and the shared problem shape, for example `422` with `{"type":"about:blank","title":"Equipment unavailable","status":422,"detail":"The equipment is not available for booking."}`. The escrow partner's `BANK_INSUFFICIENT_FUNDS` itself belongs to the payment boundary; this booking implementation does not call or simulate an external banking provider directly. Returning a failure inside `200 OK` is misleading because HTTP intermediaries, monitoring, retries and client code may treat the transport request as successful even though the operation failed.

### 3. UDDI publish, find, bind

The UDDI registry itself is not used in this implementation. **Publish** is approximated by publishing the OpenAPI contract in the repository (and could be a deployed API-doc URL). **Find** is performed by a developer or client reading that contract or a service catalogue. **Bind** happens when the client uses the configured service base URL and sends HTTP requests. A service registry/service discovery platform could automate finding the base URL, but this small assignment uses configuration rather than a live UDDI registry.

### 4. Request validation responsibility

The function `validateCreateBooking()` in `models.js` validates the request before the handler uses its fields. The cancellation endpoint also validates its `reason` before changing state. Without this manual validation, a request missing `equipmentId`, using invalid date formats, or providing an end date before the start date could be stored as an invalid booking. OpenAPI documents the schema but Express does not automatically enforce it in this implementation.

### 5. Where SOAP may still be preferable

I would consider keeping SOAP at the external payment-partner boundary if the chosen payment provider contract requires it. The guarantee being purchased is a formal WSDL/XSD contract with explicit message types and declared SOAP faults, which can be validated by SOAP tooling and code generators. This is not a claim that SOAP alone guarantees payment delivery or exactly-once charging; idempotency and provider-side transaction rules are still required.

## Validation and evidence checklist

- [ ] Replace all student/team placeholders above.
- [ ] Run `npm install` and `npm test`; save terminal output for submission.
- [ ] Run `npm run validate:openapi`; save terminal output or a screenshot showing zero errors.
- [ ] Run the service and execute the commands in `curl-transcript.sh`; save the actual terminal output as the required `curl-transcript.txt`.
- [ ] Set `EQUIPMENT_SERVICE_URL` to the actual running AgriRent Equipment Catalogue service. The local mock is only for isolated demonstration/testing and is not a production service.
