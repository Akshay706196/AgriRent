# CS543 Assignment 6 — AgriRent Booking Service

**Team ID:** 04  
**Team members (Name — Roll No):** Sundram Tripathi (20251651091, Lead), Akshay Kumar (20251651012), Abhinav Kumar Chandravanshi (20251651004), Ankit Kumar (20251651022)

This is an AgriRent adaptation of the supplied CampusEats assignment. The assignment brief asks for `/orders`; this project preserves the established AgriRent `/bookings` resource boundary from Assignments 4–5 rather than silently renaming the domain.

## A1 — Status map

| Endpoint | Success | Failure statuses and reason |
|---|---|---|
| `GET /health` | `200` health representation | `406` unsupported `Accept`; `429` rate budget exceeded |
| `GET /bookings` | `200` list | `400` invalid filter/sort/pagination; `406` unsupported representation; `429` rate budget exceeded |
| `POST /bookings` | `201` plus `Location: /bookings/{id}` | `400` missing/invalid Idempotency-Key or malformed JSON; `422` field/domain validation or unavailable equipment; `406` unsupported Accept; `429` rate limit; `503` catalogue dependency unavailable |
| `GET /bookings/{id}` | `200`; `304` if `If-None-Match` matches | `404` unknown booking; `406` unsupported Accept; `429` rate limit |
| `PUT /bookings/{id}` | `200` with refreshed `ETag` | `400` malformed JSON; `401` missing/invalid bearer token; `404` unknown booking; `409` illegal state transition; `412` stale `If-Match`; `422` field validation; `428` missing `If-Match`; `429` rate limit |
| `POST /bookings/{id}/cancellation` | `200` cancellation result | `400` malformed request; `401` missing/invalid bearer token; `404` unknown booking; `409` illegal transition; `429` rate limit |
| `OPTIONS /bookings/{id}` | `204` and `Allow` | Rate limiting can return `429` for non-OPTIONS requests; OPTIONS is exempt from the limit |
| `DELETE /bookings/{id}` | No deletion; returns `405` | `401` missing/invalid bearer token; `405` unsupported method (cancellation is a separate sub-resource) |

Status is the outcome; errors never use `200` with `{ "ok": false }`. Create returns a `Location` header pointing to the new booking. `429` includes `Retry-After`; the transient catalogue failure `503` includes `Retry-After: 2`.

## B2 — Stable Problem Details type catalogue

| Type suffix | Trigger |
|---|---|
| `empty-cart` | Reserved catalogue term from the assignment; not applicable to equipment bookings |
| `item-unavailable` | Equipment is missing or unavailable |
| `payment-declined` | Reserved catalogue term; payment is not performed by this booking service |
| `booking-not-found` | Requested booking id does not exist |
| `illegal-transition` | Attempt to update/cancel a booking in an invalid state |
| `validation-error` | One or more booking fields fail validation; includes `errors[]` |
| `unauthorized` | Missing/invalid bearer token |
| `rate-limit` | Client exceeded its request budget |
| `not-acceptable` | Requested response media type is unsupported |
| `internal-error` | Unexpected server error; internal details are logged, not returned |
| `precondition-failed` | `If-Match` ETag is stale |
| `precondition-required` | Update omitted `If-Match` |
| `bad-request` | Malformed JSON, bad idempotency key, or malformed query/request |
| `service-unavailable` | Catalogue dependency cannot be reached |

Problem bodies use `type`, `title`, `status`, and `detail`, with `Content-Type: application/problem+json; charset=utf-8`. Validation responses additionally contain `errors: [{field, reason}]`.

## B3 — Example Problem Details

Example response for a missing booking (illustrative body; capture the actual response in your transcript):

```json
{
  "type": "https://agrirent.example/problems/booking-not-found",
  "title": "Booking not found",
  "status": 404,
  "detail": "No booking exists with id 999."
}
```

- `type`: stable machine-readable problem identifier
- `title`: short human-readable summary
- `status`: HTTP status code, matching the response
- `detail`: occurrence-specific explanation safe to show the caller

## C4 — Field-level 422 with two invalid fields

Request: `POST /bookings` with a valid `Idempotency-Key` and JSON `{"equipmentId":"","renterId":"","startDate":"2026-11-01","endDate":"2026-11-03"}`. Expected `422` with both `equipmentId` and `renterId` in `errors[]`. Run the curl script to capture the exact response.

## D4 — Retry safety and Assignment 5 regression checks

- `GET /health`, `GET /bookings`, `GET /bookings/{id}`, and `OPTIONS` are safe to retry; GET reads do not change state. A matching conditional GET returns `304`.
- `POST /bookings` is not naturally idempotent, but the same `Idempotency-Key` replays the original booking without repeating catalogue lookup/creation.
- `PUT /bookings/{id}` requires `If-Match`; a stale tag returns `412` rather than overwriting a newer representation.
- Cancellation is a state-changing POST. It is not automatically retry-safe: a repeat after successful cancellation returns `409`.
- Retry transient `503` only with the same idempotency key; do not blindly retry unchanged 4xx responses.

## C3 — JSON and XML negotiation

Default/`Accept: application/json` returns JSON. `Accept: application/xml` returns an XML representation for successful resource responses. An unsupported type such as `Accept: text/html` returns `406`. Problem responses remain `application/problem+json`.

## B4 — Internal error mapping

Unexpected errors are logged server-side and mapped to a generic `500` Problem Details response. The caller does not receive stack traces, internal paths, dependency error messages, or database details.

## Transcript and validation evidence

Run `npm test`, `npm run validate:openapi`, and `bash curl-transcript.sh`. Keep the real terminal outputs. Do not label a test/validator as passed until the command output confirms it. The in-memory store resets when the process restarts and is for coursework, not production persistence.
