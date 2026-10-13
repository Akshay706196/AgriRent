#!/usr/bin/env bash
set -u
BASE="${BASE_URL:-http://localhost:5001}"
TOKEN="${API_BEARER_TOKEN:-agrirent-demo-token}"
KEY="assignment6-curl-key-001"
GOOD='{"equipmentId":"equipment-101","renterId":"renter-204","startDate":"2026-11-01","endDate":"2026-11-03"}'
echo '=== CREATE: expected 201 + Location ==='
curl -i -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H 'Accept: application/json' -H "Idempotency-Key: $KEY" -d "$GOOD"
echo; echo '=== SAME CREATE KEY: original response ==='
curl -i -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H 'Accept: application/json' -H "Idempotency-Key: $KEY" -d "$GOOD"
echo; echo '=== VALID JSON BUT TWO INVALID FIELDS: expected 422 ==='
curl -i -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'Idempotency-Key: assignment6-curl-key-002' -d '{"equipmentId":"","renterId":"","startDate":"2026-11-01","endDate":"2026-11-03"}'
echo; echo '=== UNKNOWN BOOKING: expected 404 ==='
curl -i "$BASE/bookings/999999" -H 'Accept: application/json'
echo; echo '=== MISSING AUTH: expected 401 ==='
curl -i -X PUT "$BASE/bookings/1" -H 'Content-Type: application/json' -H 'If-Match: "example"' -d "$GOOD"
echo; echo '=== UNSUPPORTED ACCEPT: expected 406 ==='
curl -i "$BASE/bookings" -H 'Accept: text/html'
echo; echo '=== XML NEGOTIATION ==='
curl -i "$BASE/bookings/1" -H 'Accept: application/xml'
echo; echo '=== RATE LIMIT: use a server started with RATE_LIMIT=1 to capture 429 + Retry-After ==='
