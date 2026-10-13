<<<<<<< HEAD
# AgriRent Assignment 4 — REST Booking Service

This folder adapts CS543 Assignment 4 to the existing AgriRent Node.js project. It implements the Booking service as REST resources, publishes `openapi.yaml`, validates inputs, uses one problem-details error shape, supports idempotent creation, and hardens an outbound HTTP GET to the Equipment Catalogue service.

## Requirements
- Node.js 18 or newer
- A running AgriRent Equipment Catalogue API compatible with `GET /api/equipment/:id`

## Run
```bash
npm install
cp .env.example .env
# Edit EQUIPMENT_SERVICE_URL to the real Equipment Catalogue base URL.
npm start
```
The Booking Service listens on `http://localhost:5001` by default.

## Test and validate
```bash
npm test
npm run validate:openapi
```

## Local-only mock for a demonstration
In terminal 1:
```bash
npm run mock-equipment
```
In terminal 2:
```bash
EQUIPMENT_SERVICE_URL=http://localhost:5002 npm start
```
The mock is a test double, not the real Catalogue service. Do not present it as a live integration.

## Important boundaries
- New booking requests start at `PENDING_OWNER_APPROVAL`; this endpoint does not approve owners or take payment.
- Data is held in memory and is lost when the process restarts. Use a database and concurrency-safe idempotency storage before production deployment.
- No credentials, security deposit, or internal idempotency key are returned in booking JSON.
- Replace student/team placeholders in `NOTES.md` before submitting.
=======
# AgriRent - Web Services Foundation

CS543: Web Services - Assignment 1 Repository

## Project Overview
AgriRent is a web-based agricultural equipment rental platform that connects equipment owners with renters. This repository contains initial HTTP protocol inspection logs, browser network performance analyses, and the foundational system brief (nouns and verbs).

## Repository Structure
agrirent/
├── README.md               # Repository documentation and guide
├── http-log.md             # Task 1: 5 raw curl HTTP requests and response logs
├── network-analysis.md     # Task 2: DevTools network panel waterfall analysis
├── brief.md                # Task 4: AgriRent system brief (nouns & verbs)
└── docs/                   # Architecture, CRD and design documentation folder

## Running Raw HTTP Requests
To verify endpoints using curl:
curl.exe -i https://jsonplaceholder.typicode.com/posts/1
>>>>>>> 4bce237e85815dfe9c7e9d46ef02b6f35273e9fe
