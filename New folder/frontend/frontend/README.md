# AgriRent Frontend

A modern, responsive React/Vite frontend for the **AgriRent** agricultural machinery rental platform, built with Service-Oriented Architecture (SOA) and connected to three independent Node.js/Express/MongoDB microservices.

---

## 1. System Architecture & Connected Services

The frontend communicates with three active microservices via RESTful JSON APIs and JWT bearer authorization:

| Service | Port | Base URL Environment Variable | Responsibility |
| :--- | :--- | :--- | :--- |
| **Equipment Service** | `4001` | `VITE_EQUIPMENT_API_URL` | Machinery listings, search, specifications, pickup locations, deactivation |
| **Booking Service** | `4002` | `VITE_BOOKING_API_URL` | Availability intervals, concurrency locks, booking requests, approvals/cancellations |
| **Identity & KYC Service** | `4003` | `VITE_IDENTITY_API_URL` | Farmer authentication, JWT token issuance, profile, eligibility, KYC verification & admin review |

### Roadmap / Placeholder Services (Not Yet Implemented)
Per system specifications, features for unbuilt services are non-functional and clearly labeled as **"Coming Soon"** or **"Roadmap"**:
- **Escrow Payments** (`/placeholders/payments`)
- **Security Deposits Management** (`/placeholders/security-deposit`)
- **Handover & Return PIN Verification** (`/placeholders/handover`)
- **Damage Claims & Insurance** (`/placeholders/claims`)
- **Dispute Resolution** (`/placeholders/disputes`)
- **Farmer & Machinery Reviews** (`/placeholders/reviews`)
- **SMS & Push Notifications** (`/placeholders/notifications`)
- **Platform Analytics** (`/placeholders/analytics`)

---

## 2. Prerequisites & Environment Setup

- **Node.js**: Version 18.x or higher (recommended 18 or 20 LTS)
- **Package Manager**: npm (v9+)
- **MongoDB**: Running locally on `mongodb://localhost:27017` or remote URI for backend services

### Install Dependencies
```bash
cd frontend
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `.env` contains the ports of your three running backend services:
```env
VITE_IDENTITY_API_URL=http://localhost:4003
VITE_EQUIPMENT_API_URL=http://localhost:4001
VITE_BOOKING_API_URL=http://localhost:4002
```

---

## 3. How to Run the Complete Stack

Start each backend microservice in its own terminal, then start the frontend:

### Terminal 1: Identity & KYC Service (Port 4003)
```bash
cd identity-kyc-service
npm install
npm run dev
```

### Terminal 2: Equipment Management Service (Port 4001)
```bash
cd equipment-service
npm install
npm run dev
```

### Terminal 3: Booking Management Service (Port 4002)
```bash
cd booking-service
npm install
npm run dev
```

### Terminal 4: Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

Open your browser at: **`http://localhost:5173`**

To produce a production build:
```bash
cd frontend
npm run build
```

---

## 4. Frontend Route & Service Mapping

| Frontend Route | Primary Component | Microservice Connected | Actions Supported |
| :--- | :--- | :--- | :--- |
| `/` | `Home.jsx` | Equipment Service (4001) | Live featured listings, search bar, categories |
| `/equipment` | `EquipmentList.jsx` | Equipment Service (4001) | Keyword search, category, city/state, price filter, pagination |
| `/equipment/:id` | `EquipmentDetails.jsx` | Equipment (4001) + Identity (4003) | Full specs, photo carousel, owner check, KYC booking gate |
| `/equipment/new` | `AddEquipment.jsx` | Equipment Service (4001) | Create machinery listing (`requireKyc` enforced) |
| `/equipment/:id/edit` | `EditEquipment.jsx` | Equipment Service (4001) | Update machinery details (`PATCH /:id`, owner only) |
| `/my-equipment` | `MyEquipment.jsx` | Equipment Service (4001) | Equipment lookup by ID, listing deactivation |
| `/bookings/new` | `CreateBooking.jsx` | Booking (4002) + Equipment (4001) | Real-time availability check, 3% fee estimate, submit request |
| `/my-bookings` | `MyBookings.jsx` | Booking Service (4002) | Renter bookings & Owner incoming requests, Approve/Reject/Cancel |
| `/bookings/:id` | `BookingDetails.jsx` | Booking (4002) + Equipment (4001) | Authoritative pricing snapshot, 24h deadline, participant actions |
| `/login` | `Login.jsx` | Identity & KYC (4003) | Email/password login, JWT storage |
| `/register` | `Register.jsx` | Identity & KYC (4003) | Farmer registration (name, email, phone, password) |
| `/profile` | `Profile.jsx` | Identity & KYC (4003) | View profile, update name/phone, change password, view eligibility |
| `/kyc` | `KYC.jsx` | Identity & KYC (4003) | Submit Aadhaar/PAN reference, status display, admin review panel |
| `/dashboard` | `Dashboard.jsx` | All 3 Services (4001, 4002, 4003) | KYC status, pending rentals, incoming requests, recent activity |
| `/placeholders/:id` | `PlaceholderPage.jsx` | None (Placeholder metadata) | Explains planned features for future services |

---

## 5. Known Integration Limitations & Architecture Notes

1. **Equipment Service Owner Query Limitation**:
   - `GET /api/v1/equipment` in `equipment-service` supports filtering by `category`, `condition`, `city`, `state`, and `pricePerDay`, but does not expose an `ownerId` query parameter or a `GET /my-equipment` route.
   - Per security rules, the frontend does not download all public listings into the browser to filter client-side. Instead, `MyEquipment.jsx` provides an Equipment ID lookup and links to direct management actions (`/equipment/:id/edit`, deactivation).
2. **KYC Secure Document Upload**:
   - The Identity & KYC backend accepts a `documentReference` string (e.g., S3 URI or cloud vault token) rather than raw binary multipart uploads. The KYC submission page explains this contract and collects reference IDs.
3. **Half-Open Booking Intervals**:
   - The Booking Service calculates duration using half-open intervals `[startDate, endDate)`. For example, renting from `2026-10-15` to `2026-10-17` equals exactly 2 rental days. The frontend aligns strictly with this formula.
4. **Platform Fee**:
   - The Booking Service applies an authoritative 3% platform fee: `Math.round(rentalAmount * 0.03 * 100) / 100`. The frontend displays this exact estimate.

---

## 6. Troubleshooting

- **CORS Errors**: All three microservices include `cors()` enabled in their `app.js`. If you see CORS errors, confirm that the backend services are running on ports 4001, 4002, and 4003.
- **Network Error / Failed to Fetch**: Check if MongoDB is running and that the corresponding backend service has started without database connection errors.
- **Unauthorized (401 / 403)**: JWT tokens are stored in `localStorage` under `agrirent_token`. Logging out and logging back in will refresh your session token.
