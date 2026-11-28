# AgriRent — Equipment Management Microservice

The **Equipment Management Service** handles agricultural machinery cataloging, specifications, pricing, security deposits, listing statuses, and availability queries.

## 1. Features
- **Listing Lifecycle:** Create, update, search, filter, and soft-deactivate equipment.
- **Role-Based Security:** Only verified equipment owners can create and modify listings.
- **Authoritative Single Source of Truth:** Manages machine specifications, condition, daily rates, and security deposits.
- **Cross-Service Deactivation Safety:** Checks with Booking Service before deactivating equipment to ensure no active bookings exist.
- **Availability Query Delegation:** Exposes read-only availability checks by querying Booking Service.
- **Geospatial & Filter Indexes:** Optimized MongoDB queries with `2dsphere` index for location and compound indexes for fast search.

---

## 2. Environment Variables

Create `.env` based on `.env.example`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP Port | `4001` |
| `NODE_ENV` | Environment (`development`, `test`, `production`) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/agrirent_equipment` |
| `JWT_SECRET` | Secret key for verifying JWT signatures | `agrirent_super_secret_jwt_key_2026_dev` |
| `BOOKING_SERVICE_URL` | Base URL of Booking Service | `http://localhost:4002` |
| `MOCK_AUTH` | Enable dev headers (`x-user-id`, etc.) | `false` |

---

## 3. Installation & Run Commands

```bash
# Navigate to service directory
cd equipment-service

# Install dependencies
npm install

# Start in development mode (with nodemon)
npm run dev

# Start in production mode
npm start

# Run automated tests
npm test
```

---

## 4. API Endpoints Reference

### Health Check
- `GET /health`: Health status.

### Equipment Endpoints (`/api/v1/equipment`)
- `POST /api/v1/equipment`: Create new listing (Requires JWT + KYC Verified).
- `GET /api/v1/equipment`: Search and filter listings (Public).
- `GET /api/v1/equipment/:equipmentId`: Retrieve details by ID (Public).
- `PATCH /api/v1/equipment/:equipmentId`: Update listing (Owner only).
- `DELETE /api/v1/equipment/:equipmentId`: Soft-delete/deactivate listing (Owner only).
- `GET /api/v1/equipment/:equipmentId/availability`: Check dates availability (Public).

---

## 5. Sample Requests

### Create Listing
```bash
curl -X POST http://localhost:4001/api/v1/equipment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Mahindra 575 DI Tractor",
    "category": "TRACTOR",
    "description": "45 HP powerful tractor with dual clutch, ideal for rotavator and haulage",
    "brand": "Mahindra",
    "condition": "GOOD",
    "manufacturingYear": 2022,
    "pricePerDay": 2500,
    "securityDeposit": 5000,
    "pickupAddress": {
      "address": "Village Farm Road 4",
      "city": "Gandhinagar",
      "state": "Gujarat",
      "postalCode": "382010"
    },
    "status": "ACTIVE"
  }'
```

### Search Listings
```bash
curl "http://localhost:4001/api/v1/equipment?category=TRACTOR&city=Gandhinagar&minPrice=1000&maxPrice=3000&page=1&limit=10"
```
