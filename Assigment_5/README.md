# AgriRent Assignment 5 — HTTP Methods & Headers

This is a separate assignment folder that extends the Assignment 4 Booking REST service. It is adapted to AgriRent; the supplied brief names CampusEats, so confirm with your instructor that using your actual project is acceptable.

## Requirements
- Node.js 18+
- The Equipment Catalogue API from AgriRent, or the included local mock for a demonstration

## Setup
```bash
npm install
cp .env.example .env
# Set EQUIPMENT_SERVICE_URL to the real catalogue API base URL.
# Example for local mock: http://localhost:5002
```

## Run
Terminal 1:
```bash
npm run mock-equipment
```
Terminal 2:
```bash
EQUIPMENT_SERVICE_URL=http://localhost:5002 npm start
```
The booking service listens on port 5001. The default demo bearer token is `agrirent-demo-token`; set `API_BEARER_TOKEN` to change it. This is header validation for the assignment, not a real user authentication system.

## Verify
```bash
npm test
npm run validate:openapi
```
Then run `./curl-transcript.sh`. The conditional GET step needs the real ETag returned by the first GET; set `ETAG` to that exact header value when rerunning the script to show a genuine 304. Keep actual terminal output for submission rather than claiming unrun commands passed.

## Important limits
- Booking records and idempotency keys are held in memory and disappear on restart. Production needs persistent, concurrency-safe storage.
- `Strict-Transport-Security` is useful only when production traffic is served over HTTPS; local development here uses HTTP.
- The catalogue mock is a test double, not a live production service.
