# CS543 Assignment 4: Rebuilding Booking Service in REST

Author: 
 1. Akshay Kumar-20251651012
2. Sundram Tripathi-20251651091
3. Abhinav Kumar Chandravanshi -20251651004
4. Ankit Kumar -20251651022
**Course:** CS543 Web Services  
**Service:** AgriRent Booking Service  

---

## Part A: Resource Modeling

### A4: Resource Table

| Method | URL | What it does | Success Code | Failure Codes |
| :--- | :--- | :--- | :---: | :--- |
| **POST** | `/v1/bookings` | Creates a new machinery rental reservation record | `201 Created` | `400 Bad Request`, `409 Conflict`, `422 Unprocessable Entity` |
| **GET** | `/v1/bookings` | Lists bookings with optional `?status=` operational filter | `200 OK` | `400 Bad Request` |
| **GET** | `/v1/bookings/{id}` | Fetches a single booking representation by unique ID | `200 OK` | `404 Not Found` |
| **POST** | `/v1/bookings/{id}/cancellation` | State-changing sub-resource representing cancellation event | `200 OK` | `404 Not Found`, `409 Conflict` |

### A5: Justification of the Hardest Mapping Choice

Mapping the cancellation action was the least comfortable fit for a pure resource model. The naive approach was either `DELETE /bookings/{id}` or an RPC-style verb like `POST /bookings/{id}/cancel`. We rejected `DELETE` because equipment rental agreements carry regulatory, financial, and deposit refund auditing requirements; records must never be purged from storage. We also rejected verbs in the URL as a violation of REST constraints. We resolved this by treating cancellation as a state-changing sub-resource (`POST /v1/bookings/{id}/cancellation`) requiring a mandatory `cancellation_reason` payload, making the cancellation event a durable first-class resource.

---

## Part D: Network Resilience & Fallback

### D3: Fallback Strategy & Reasoning

When the external Payment gateway is unreachable or returns transient 5xx errors, the Booking service retries up to 3 times with exponential backoff and randomized full jitter. If all retries fail, the service adopts a **fail-fast** policy: it rejects the booking with an RFC-7807 problem response rather than gracefully degrading.

**Justification:** In an agricultural machinery marketplace, degrading by accepting an unconfirmed booking without an authorized payment/escrow hold creates double-booking risks and financial liability for machine owners. Degraded optimistic acceptance would risk having owners mobilize tractors without guaranteed escrow payment. Thus, failing immediately and safely preserves business integrity.

---

## Answers to Mandatory Questions

### 1. Line Count Comparison (WSDL vs OpenAPI)
* **Assignment 3 WSDL:** ~145 lines.
* **Assignment 4 openapi.yaml:** ~140 lines.
* **What the difference is made of:** The WSDL line count was heavily consumed by procedural protocol scaffolding, message parts, and transport binding layers.
* **Two things WSDL declared that OpenAPI does not need to:**
  1. Explicit XML namespaces (`xmlns:tns`, `targetNamespace`, `soapenv:Envelope`).
  2. Concrete binding and transport plumbing (`<wsdl:binding>`, `soap:binding transport="http://schemas.xmlsoap.org/soap/http"`, and SOAPAction headers).

### 2. SOAP Fault vs RFC-7807 Problem Details
* **Quoted SOAP Fault from Assignment 3:**
  ```xml
  <soapenv:Fault>
    <faultcode>soapenv:Client</faultcode>
    <faultstring>Escrow authorization failed: Payer instrument has insufficient credit limit</faultstring>
    <detail>
      <esc:EscrowFaultDetail>
        <esc:PartnerErrorCode>BANK_INSUFFICIENT_FUNDS</esc:PartnerErrorCode>
      </esc:EscrowFaultDetail>
    </detail>
  </soapenv:Fault>