#!/usr/bin/env bash
# Run after starting the local mock and Booking Service as described in README.md.
# These commands produce the actual -i HTTP transcript required by the assignment.
set -euo pipefail
BASE="${BASE_URL:-http://localhost:5001}"
KEY="agrirent-demo-key-0001"
BODY='{"equipmentId":"equipment-101","renterId":"renter-204","startDate":"2026-11-01","endDate":"2026-11-03"}'

echo '===== 1. Successful create (expect 201 and Location) ====='
curl -i -sS -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" --data "$BODY"
echo -e '\n===== 2. Same request + same key (original result) ====='
curl -i -sS -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" --data "$BODY"
echo -e '\n===== 3. Malformed body (expect 400) ====='
curl -i -sS -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H 'Idempotency-Key: agrirent-demo-key-0002' --data '{"equipmentId":'
echo -e '\n===== 4. Missing booking (expect 404) ====='
curl -i -sS "$BASE/bookings/999999"
echo -e '\n===== 5. State conflict (create, cancel, cancel again -> 409) ====='
CREATED=$(curl -sS -X POST "$BASE/bookings" -H 'Content-Type: application/json' -H 'Idempotency-Key: agrirent-demo-key-0003' --data "$BODY")
ID=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))' <<< "$CREATED")
curl -i -sS -X POST "$BASE/bookings/$ID/cancellation" -H 'Content-Type: application/json' --data '{"reason":"Changed plans"}'
curl -i -sS -X POST "$BASE/bookings/$ID/cancellation" -H 'Content-Type: application/json' --data '{"reason":"Retry cancellation"}'
