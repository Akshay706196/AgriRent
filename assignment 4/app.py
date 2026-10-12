import os
import random
import time
from datetime import datetime
import requests
from flask import Flask, request, jsonify, make_response
from models import BookingRecord
from store import store
from errors import problem

app = Flask(__name__)

PAYMENT_SERVICE_URL = os.environ.get("PAYMENT_SERVICE_URL", "http://localhost:5001/v1/holds")

# --- TASK C4: HAND-CRAFTED VALIDATION FUNCTION ---
def validate_booking_payload(data: dict):
    """
    Manual request body validation (replaces automatic XML schema validation).
    Returns (is_valid, error_tuple)
    """
    if not isinstance(data, dict):
        return False, (400, "Bad Request", "Request body must be a valid JSON object.", "malformed-json")

    required_fields = ["renter_id", "equipment_id", "start_date", "end_date", "rental_rate_per_day"]
    for field in required_fields:
        if field not in data or data[field] is None:
            return False, (400, "Missing Required Field", f"Field '{field}' is required.", "missing-field")

    # Date parsing and business integrity checks
    try:
        d1 = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        d2 = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
    except ValueError:
        return False, (400, "Invalid Date Format", "Dates must follow YYYY-MM-DD format.", "invalid-date-format")

    if d2 <= d1:
        return False, (422, "Unprocessable Entity", "end_date must be strictly after start_date.", "invalid-date-order")

    try:
        rate = float(data["rental_rate_per_day"])
        if rate <= 0:
            return False, (422, "Unprocessable Entity", "rental_rate_per_day must be positive.", "invalid-rate")
    except (ValueError, TypeError):
        return False, (400, "Invalid Data Type", "rental_rate_per_day must be a numeric value.", "invalid-data-type")

    return True, None


# --- TASK D1 & D2: HARDENED OUTBOUND HTTP CALL WITH EXPONENTIAL BACKOFF & JITTER ---
def call_payment_hold_with_resilience(booking_id: str, amount: float, idempotency_key: str):
    """
    Calls Payment Service with timeout, exponential backoff, and full jitter.
    Never retries 4xx client errors (Task D2).
    """
    max_retries = 3
    base_backoff = 0.5  # seconds
    timeout_seconds = 2.0

    payload = {
        "booking_id": booking_id,
        "hold_amount": amount
    }
    headers = {
        "Content-Type": "application/json",
        "Idempotency-Key": f"pay_hold_{idempotency_key or booking_id}"
    }

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(PAYMENT_SERVICE_URL, json=payload, headers=headers, timeout=timeout_seconds)
            
            # Safe boundary: Never retry 4xx errors
            if 400 <= response.status_code < 500:
                return False, f"Payment declined by gateway: HTTP {response.status_code}"

            if response.status_code in (200, 201):
                return True, "Payment hold authorized"

        except (requests.Timeout, requests.ConnectionError) as exc:
            if attempt == max_retries:
                # Task D3 Fallback: Documented fail-fast choice
                return False, f"Payment gateway unreachable after {max_retries} attempts: {str(exc)}"

            # Exponential backoff + full jitter: sleep = random between 0 and (base * 2^attempt)
            sleep_duration = random.uniform(0, base_backoff * (2 ** (attempt - 1)))
            time.sleep(sleep_duration)

    return False, "Payment hold failed"


# --- TASK C3: ENDPOINTS ---

# 1. Create Booking (POST /v1/bookings) with Task C7 Idempotency
@app.route("/v1/bookings", methods=["POST"])
def create_booking():
    idempotency_key = request.headers.get("Idempotency-Key")

    # Idempotency check: return previous result without repeating side effects
    if idempotency_key:
        cached = store.get_idempotent_response(idempotency_key)
        if cached:
            resp = make_response(jsonify(cached["payload"]), cached["status_code"])
            for h_key, h_val in cached["headers"].items():
                resp.headers[h_key] = h_val
            resp.headers["X-Cache-Lookup"] = "HIT-IDEMPOTENT"
            return resp

    raw_body = request.get_json(silent=True)
    if raw_body is None:
        return problem(400, "Malformed Request", "Malformed JSON body.", "malformed-json")

    is_valid, err = validate_booking_payload(raw_body)
    if not is_valid:
        status, title, detail, type_suf = err
        return problem(status, title, detail, type_suf)

    # 409 Conflict check
    if store.has_conflict(raw_body["equipment_id"], raw_body["start_date"], raw_body["end_date"]):
        return problem(409, "Conflict", f"Equipment {raw_body['equipment_id']} is already booked for these dates.", "schedule-conflict")

    # Instantiate model
    record = BookingRecord(
        renter_id=raw_body["renter_id"],
        equipment_id=raw_body["equipment_id"],
        start_date=raw_body["start_date"],
        end_date=raw_body["end_date"],
        rental_rate_per_day=raw_body["rental_rate_per_day"],
        idempotency_key=idempotency_key
    )

    store.save(record)

    location_header = f"/v1/bookings/{record.public_id}"
    response_payload = record.as_json()

    # Cache for idempotency key if provided
    if idempotency_key:
        store.save_idempotent_response(
            idempotency_key,
            response_payload,
            201,
            {"Location": location_header}
        )

    resp = make_response(jsonify(response_payload), 201)
    resp.headers["Location"] = location_header
    return resp


# 2. Filtered List (GET /v1/bookings?status=...)
@app.route("/v1/bookings", methods=["GET"])
def list_bookings():
    status_filter = request.args.get("status")
    allowed_statuses = ["PENDING", "CONFIRMED", "CANCELLED"]

    if status_filter and status_filter.upper() not in allowed_statuses:
        return problem(400, "Bad Request", f"Invalid status filter. Allowed: {allowed_statuses}", "invalid-query-filter")

    items = store.list_all(status_filter.upper() if status_filter else None)
    return jsonify([item.as_json() for item in items]), 200


# 3. Read Single Resource (GET /v1/bookings/<id>)
@app.route("/v1/bookings/<booking_id>", methods=["GET"])
def get_booking(booking_id):
    record = store.get_by_id(booking_id)
    if not record:
        return problem(404, "Not Found", f"Booking with id '{booking_id}' does not exist.", "booking-not-found")
    return jsonify(record.as_json()), 200


# 4. State-Changing Sub-Resource (POST /v1/bookings/<id>/cancellation)
@app.route("/v1/bookings/<booking_id>/cancellation", methods=["POST"])
def cancel_booking(booking_id):
    record = store.get_by_id(booking_id)
    if not record:
        return problem(404, "Not Found", f"Booking '{booking_id}' not found.", "booking-not-found")

    if record.status == "CANCELLED":
        return problem(409, "Conflict", "Booking is already cancelled.", "already-cancelled")

    raw_body = request.get_json(silent=True)
    if not raw_body or "cancellation_reason" not in raw_body or not str(raw_body["cancellation_reason"]).strip():
        return problem(400, "Bad Request", "Field 'cancellation_reason' is required.", "missing-reason")

    record.status = "CANCELLED"
    record.cancellation_reason = raw_body["cancellation_reason"].strip()
    return jsonify(record.as_json()), 200


if __name__ == "__main__":
    app.run(port=5000, debug=True)