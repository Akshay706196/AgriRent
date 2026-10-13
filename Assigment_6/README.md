# AgriRent Assignment 6

Node.js/Express continuation of the Assignment 5 booking service. Includes stable Problem Details errors, field-level `422` validation, JSON/XML content negotiation, correct create `Location`, `Retry-After`, and regression tests for idempotency and ETag conditional requests.

## Requirements
- Node.js 18+
- npm

## Run
```bash
npm install
npm test
npm run validate:openapi
npm start
```

In another terminal, run `bash curl-transcript.sh` to exercise the success and failure paths. The script prints actual `curl -i` responses; save the output as `transcript.txt` for submission. Replace Team ID and member placeholders in `NOTES.md`.

## Demo configuration
```bash
export API_BEARER_TOKEN=agrirent-demo-token
export EQUIPMENT_SERVICE_URL=http://localhost:5002
export PORT=5001
npm start
```

The bearer token is a coursework demo only. Booking data is in-memory and resets on restart. This is not production authentication or durable storage.
