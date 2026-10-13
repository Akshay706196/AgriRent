#!/usr/bin/env bash
# Run after starting the mock equipment service and Assignment 5 service.
# Captures verbose HTTP exchanges; review/keep the resulting curl-transcript.txt.
set -u
BASE="${BASE_URL:-http://localhost:5001}"
TOKEN="${API_BEARER_TOKEN:-agrirent-demo-token}"
KEY="assignment5-demo-key-001"
BODY='{"equipmentId":"equipment-101","renterId":"renter-204","startDate":"2026-11-01","endDate":"2026-11-03"}'
OUT="curl-transcript.txt"
: > "$OUT"
run() { printf '\n\n===== %s =====\n' "$1" | tee -a "$OUT"; shift; curl -v "$@" 2>&1 | tee -a "$OUT"; }
run 'Create booking: expect 201 + Location' -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" -d "$BODY"
run 'Repeat same idempotency key: original result' -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" -d "$BODY"
run 'Read booking and capture ETag' -D - "$BASE/bookings/1"
# Replace this placeholder with the ETag printed by the previous read for a genuine 304.
ETAG="${ETAG:-\"replace-with-real-etag\"}"
run 'Conditional GET: expect 304 when ETAG is set to actual value' -H "If-None-Match: $ETAG" "$BASE/bookings/1"
run 'Conditional write with stale ETag: expect 412' -X PUT "$BASE/bookings/1" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'If-Match: "stale-etag"' -d '{"startDate":"2026-11-02","endDate":"2026-11-03"}'
run 'Malformed create: expect 400' -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H 'Idempotency-Key: assignment5-bad-key' -d '{"equipmentId":"only-one-field"}'
run 'Unknown booking: expect 404' "$BASE/bookings/999999"
run 'Missing bearer token on protected cancellation: expect 401' -X POST "$BASE/bookings/1/cancellation" -H 'Content-Type: application/json' -d '{"reason":"test"}'
