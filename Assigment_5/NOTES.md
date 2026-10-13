# CS543 Assignment 5 — AgriRent Booking Service: HTTP Methods & Headers

**Team ID:** 04  
**Team members (Name — Roll No):** Sundram Tripathi (20251651091, Lead), Akshay Kumar (20251651012), Abhinav Kumar Chandravanshi (20251651004), Ankit Kumar (20251651022)

> This is the AgriRent adaptation of the CS543 Assignment 5 specification. The implementation extends the Assignment 4 Booking REST service with comprehensive HTTP header semantics, content negotiation, per-client rate limiting, conditional requests via ETags, and CORS preflight handling.

---

## Part A · Methods & the Message

### A1. AgriRent Method Map

| Action | Method + URL | Success Status | Safe? | Idempotent? |
|---|---|---:|---|---|
| Check service health | `GET /health` | 200 OK | Yes | Yes |
| List/filter/sort/paginate bookings | `GET /bookings?status=...&sort=createdAt&order=asc&limit=20&offset=0` | 200 OK | Yes | Yes |
| Create booking request | `POST /bookings` | 201 Created + `Location` | No | No (Naturally) / Yes (with `Idempotency-Key`) |
| Read single booking item | `GET /bookings/{id}` | 200 OK (or 304 Not Modified) | Yes | Yes |
| Query supported methods | `OPTIONS /bookings/{id}` | 204 No Content + `Allow` | Yes | Yes |
| Replace editable booking dates | `PUT /bookings/{id}` | 200 OK + refreshed `ETag` | No | Yes (Idempotent state replacement guarded by `If-Match`) |
| Request booking cancellation | `POST /bookings/{id}/cancellation` | 200 OK | No | No (State transition; repeat causes 409 Conflict) |
| Attempt direct deletion | `DELETE /bookings/{id}` | 405 Method Not Allowed | Yes (no change) | Yes |

*Audit note:* No verb leaks into any primary URL. All actions use noun resources (`/bookings`), and non-CRUD lifecycle actions are modeled as sub-resources (`POST /bookings/{id}/cancellation`).

### A5. Hard Resource Choice
Cancellation is not a passive replacement of the booking record; it is a business domain lifecycle transition subject to validation rules (e.g., owner approval state). I modeled it as a sub-resource `POST /bookings/{id}/cancellation` carrying a mandatory reason document. I rejected `POST /cancelBooking` because it puts procedural verbs into the URI path, and rejected `GET /cancelBooking?id=...` because GET must remain strictly safe and must not alter server state.

### A6. Show One Full Exchange (Labelled Request and Response)

#### Complete HTTP Request
```http
POST /bookings HTTP/1.1
Host: localhost:5001
Content-Type: application/json
Accept: application/json
Idempotency-Key: agrirent-safe-key-101
Content-Length: 104

{
  "equipmentId": "equipment-101",
  "renterId": "renter-204",
  "startDate": "2026-11-01",
  "endDate": "2026-11-03"
}
```

- **Request Line:** `POST /bookings HTTP/1.1` (specifies the HTTP verb `POST`, target resource path `/bookings`, and protocol version `HTTP/1.1`).
- **Host Header:** `Host: localhost:5001` (specifies target domain authority, mandatory in HTTP/1.1).
- **Request Headers:**
  - `Content-Type: application/json`: Informs the server that the payload format is JSON.
  - `Accept: application/json`: Declares the representation media type acceptable to the client.
  - `Idempotency-Key: agrirent-safe-key-101`: Client-generated unique token enabling safe retries.
  - `Content-Length: 104`: Byte length of the JSON body.
- **Request Body:** JSON document containing equipment, renter, and calendar rental dates.

#### Complete HTTP Response
```http
HTTP/1.1 201 Created
Location: /bookings/1
Content-Type: application/json; charset=utf-8
ETag: "9b3c4a17ef82d60a1e35bc41"
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Access-Control-Allow-Origin: *
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
Vary: Accept, Origin, Accept-Encoding
Date: Mon, 12 Oct 2026 15:30:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 173

{
  "id": "1",
  "equipmentId": "equipment-101",
  "renterId": "renter-204",
  "startDate": "2026-11-01",
  "endDate": "2026-11-03",
  "status": "PENDING_OWNER_APPROVAL",
  "createdAt": "2026-10-12T15:30:00.000Z"
}
```

- **Status Line:** `HTTP/1.1 201 Created` (protocol version `HTTP/1.1`, status code `201`, status phrase `Created`).
- **Response Headers:**
  - `Location: /bookings/1`: Identifies the canonical URI of the newly created booking resource.
  - `Content-Type: application/json; charset=utf-8`: Response media type and character encoding.
  - `ETag: "9b3c4a17ef82d60a1e35bc41"`: Entity tag representing the hash fingerprint of this representation.
  - `X-Content-Type-Options: nosniff`: Prevents browser MIME-type sniffing attacks.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`: HSTS policy enforcing HTTPS.
  - `Access-Control-Allow-Origin: *`: Permits authorized cross-origin browser clients.
  - `X-RateLimit-Limit: 100` / `X-RateLimit-Remaining: 99`: Per-client rate limit budget signalling.
- **Response Body:** Serialized JSON representation of the created booking record.

---

## Part B · Headers on Every Message

### D2. Headers Table by Endpoint

| Endpoint | Request Headers Needed | Response Headers Set |
|---|---|---|
| `GET /health` | `Accept` (optional) | `Content-Type`, `X-Content-Type-Options`, `Strict-Transport-Security`, CORS, Rate-Limit |
| `GET /bookings` | `Accept: application/json`, query params | `Content-Type`, `Vary`, CORS, Security, Rate-Limit |
| `POST /bookings` | `Content-Type: application/json`, `Accept`, `Idempotency-Key` | `201`, `Location`, `Content-Type`, CORS, Security, Rate-Limit |
| `GET /bookings/{id}` | `Accept`, optional `If-None-Match` | `ETag`, `Cache-Control: private, max-age=0, must-revalidate`, `Content-Type` (or `304 Not Modified` with no body) |
| `OPTIONS /bookings/{id}` | Optional browser preflight headers | `204 No Content`, `Allow: GET, PUT, DELETE, OPTIONS`, CORS preflight headers |
| `PUT /bookings/{id}` | `Authorization: Bearer <token>`, `If-Match: <etag>`, `Content-Type` | `ETag` (refreshed), `Content-Type` (or `412 Precondition Failed` / `428 Precondition Required`) |
| `POST /bookings/{id}/cancellation` | `Authorization: Bearer <token>`, `Content-Type: application/json` | `Content-Type: application/json` (or `401`/`404`/`409` Problem Details) |
| `DELETE /bookings/{id}` | `Authorization: Bearer <token>` | `405 Method Not Allowed`, `Allow: GET, PUT, OPTIONS`, `Content-Type: application/problem+json` |

---

## Part C · Caching & Safe Retries

### C4. The Safe-Retry Plan

| Risky Endpoint | Applied Mechanism | Architectural Justification |
|---|---|---|
| `POST /bookings` | `Idempotency-Key` | Non-idempotent creation. If network connection drops after server processing, replaying the request with the identical key returns the original `201 Created` resource without placing a second booking or re-invoking the catalogue service. |
| `GET /bookings/{id}` | `If-None-Match` + `ETag` | Safe read. If the client cached representation matches the server representation, server replies with `304 Not Modified` without transferring payload bytes. |
| `PUT /bookings/{id}` | `If-Match` + `ETag` | Guarded idempotent write (Optimistic Concurrency Control). Prevents mid-air collisions where two users update the booking concurrently ("lost update" problem). |
| `POST /bookings/{id}/cancellation` | State-Machine Check (`409 Conflict`) | State-altering action. A second cancellation request returns `409 Conflict`, compelling callers to query current booking state before retrying. |

---

## Part D · Answers to NOTES.md Questions

### 1. For three of your endpoints, give the method, success status, and single response header that matters most — and why.
- **`POST /bookings` (201 Created):** The most critical response header is **`Location: /bookings/{id}`**. On resource creation, `Location` tells the client exactly where the new resource lives so it can subsequently inspect or reference it without parsing the response body.
- **`GET /bookings/{id}` (200 OK):** The most critical response header is **`ETag: "hash..."`**. It provides a cryptographic fingerprint of the resource state, enabling conditional cache validation (`If-None-Match`) and concurrency protection (`If-Match`).
- **Rate-limited requests (429 Too Many Requests):** The most critical response header is **`Retry-After: <seconds>`**. It informs throttled clients exactly how many seconds to wait before attempting another request, preventing aggressive retry storms.

### 2. Which of your endpoints are safe, and which are idempotent? Which one is neither, and how did you make it retry-safe?
- **Safe:** `GET /health`, `GET /bookings`, `GET /bookings/{id}`, and `OPTIONS /bookings/{id}`. They do not alter server state. Because they are safe, they are naturally idempotent.
- **Idempotent:** `PUT /bookings/{id}` is designed to be idempotent because replacing a resource with the same representation produces the same resulting server state.
- **Neither Safe nor Idempotent:** `POST /bookings` is neither safe (creates a record) nor naturally idempotent (repeated raw POSTs would create duplicate bookings). I made it retry-safe by implementing an **`Idempotency-Key`** header; the server stores the key alongside the record and replays the original response on duplicate submissions.

### 3. Show one ETag from your service, the request that returns 304, and the write that returns 412. What does each save or prevent?
- **Generated ETag:** `"e9036987114b036914b1c7dc"` (SHA-256 hash slice of the JSON representation).
- **Request returning 304:**
  ```http
  GET /bookings/1 HTTP/1.1
  Host: localhost:5001
  If-None-Match: "e9036987114b036914b1c7dc"
  ```
  *What it saves:* Saves network bandwidth and processing latency by returning `304 Not Modified` with an empty body, allowing the client to serve its local cache.
- **Write returning 412:**
  ```http
  PUT /bookings/1 HTTP/1.1
  Host: localhost:5001
  Authorization: Bearer agrirent-demo-token
  If-Match: "stale-etag-hash"
  Content-Type: application/json

  {"startDate":"2026-11-05","endDate":"2026-11-08"}
  ```
  *What it prevents:* Prevents the **Lost Update Problem** by returning `412 Precondition Failed` if another user modified the booking in the interim.

### 4. You return 422 for one case and 400 for another. Give the exact request that triggers each, and explain the difference.
- **400 Bad Request Trigger:**
  ```http
  POST /bookings HTTP/1.1
  Host: localhost:5001
  Idempotency-Key: valid-key-0001
  Content-Type: application/json

  {"equipmentId": "equipment-101", "startDate": "invalid-date"}
  ```
  *Explanation:* Syntax/Schema violation. The request is malformed because `startDate` fails regex date formatting and mandatory field `renterId` is missing.
- **422 Unprocessable Entity Trigger:**
  ```http
  POST /bookings HTTP/1.1
  Host: localhost:5001
  Idempotency-Key: valid-key-0002
  Content-Type: application/json

  {"equipmentId": "missing-tractor-99", "renterId": "renter-204", "startDate": "2026-11-01", "endDate": "2026-11-03"}
  ```
  *Explanation:* Semantic/Domain rule violation. The JSON is perfectly structured, but the business domain refuses it because the Equipment Catalogue reports that machinery `missing-tractor-99` does not exist or is unavailable.

### 5. A browser page on another origin calls your API and is blocked — yet your server logs show a 200. Who blocked it, and which response header fixes it?
The **client's web browser** blocked the response due to the Same-Origin Policy (SOP). The server executed the request and returned 200, but the browser withheld the response from client JavaScript because the server did not supply an appropriate **`Access-Control-Allow-Origin`** header (e.g. `Access-Control-Allow-Origin: *` or `Access-Control-Allow-Origin: https://app.agrirent.example`).

### 6. Name one response where you set Cache-Control to allow caching and one where you must use no-store. Why each?
- **Allow Caching (`Cache-Control: private, max-age=0, must-revalidate`):** Applied to `GET /bookings/{id}`. This permits the browser to cache the booking representation privately but forces it to revalidate with the server using `If-None-Match` before rendering.
- **Disallow Caching (`Cache-Control: no-store`):** Mandatory for authentication responses (`POST /auth/login` returning session tokens or passwords) and financial transaction receipts. `no-store` instructs all clients and proxies never to write any portion of the request or response to disk or cache storage.

### 7. Your search endpoint is a GET. When would POST be the right choice instead, and what do you give up by switching?
- **When POST is appropriate:** When the search criteria require a massive, deeply nested query payload (such as multi-polygon geospatial search boundaries or complex multi-parameter filter arrays) that exceeds URI length limits (~2048 chars), or when the query parameters contain highly sensitive personal information that must not be exposed in browser history, proxy access logs, or HTTP Referer headers.
- **What you give up:** You lose natural HTTP caching (proxies do not cache POST), safe idempotent semantics, bookmarkability, and the ability for users to share search result links via URLs.

### 8. Location appears on a 201 and on a 3xx. What does it point to in each case?
- **On a `201 Created`:** `Location` points to the canonical URI of the **newly created resource** (e.g., `/bookings/1`).
- **On a `3xx Redirect` (e.g., 301/302/307/308):** `Location` points to the **target URI** where the client should re-direct its request to find the resource.
