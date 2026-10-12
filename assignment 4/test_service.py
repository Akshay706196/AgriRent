import pytest
from app import app
from store import store

@pytest.fixture(autouse=True)
def reset_store():
    # Har test se pehle store ko clear karein taaki tests isolated rahein
    store._records.clear()
    store._idempotency_cache.clear()

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client

# Test 1: Create succeeds with HTTP 201 and Location header
def test_create_booking_success(client):
    payload = {
        "renter_id": "usr_akshay_01",
        "equipment_id": "eq_tractor_johndeere_5050",
        "start_date": "2026-11-01",
        "end_date": "2026-11-05",
        "rental_rate_per_day": 1800.00
    }
    response = client.post("/v1/bookings", json=payload)
    assert response.status_code == 201
    assert "Location" in response.headers
    data = response.get_json()
    assert data["status"] == "PENDING"
    assert data["total_days"] == 4
    assert data["total_cost"] == 7200.00
    assert response.headers["Location"] == f"/v1/bookings/{data['id']}"

# Test 2: Idempotent repeat returns the original result without duplicate creation
def test_idempotent_retry_returns_original(client):
    payload = {
        "renter_id": "usr_akshay_02",
        "equipment_id": "eq_harvester_combine_88",
        "start_date": "2026-11-10",
        "end_date": "2026-11-12",
        "rental_rate_per_day": 3500.00
    }
    headers = {"Idempotency-Key": "idemp-req-unique-9988"}
    
    # First call: creates resource
    first_res = client.post("/v1/bookings", json=payload, headers=headers)
    assert first_res.status_code == 201
    first_data = first_res.get_json()

    # Second call with the same key: returns cached response
    second_res = client.post("/v1/bookings", json=payload, headers=headers)
    assert second_res.status_code == 201
    assert second_res.headers.get("X-Cache-Lookup") == "HIT-IDEMPOTENT"
    second_data = second_res.get_json()

    assert first_data["id"] == second_data["id"]
    assert len(store._records) == 1

# Test 3: Failure path returns right 4xx (422 Unprocessable Entity for invalid date order)
def test_validation_failure_returns_4xx(client):
    invalid_payload = {
        "renter_id": "usr_akshay_03",
        "equipment_id": "eq_cultivator_rotavator_02",
        "start_date": "2026-11-15",
        "end_date": "2026-11-10",  # Invalid: end_date earlier than start_date
        "rental_rate_per_day": 1200.00
    }
    response = client.post("/v1/bookings", json=invalid_payload)
    assert response.status_code == 422
    assert response.headers["Content-Type"] == "application/problem+json"
    problem_data = response.get_json()
    assert problem_data["title"] == "Unprocessable Entity"
    assert "end_date must be strictly after start_date" in problem_data["detail"]

# Test 4: Unknown ID returns HTTP 404 with standard problem details
def test_unknown_id_returns_404(client):
    response = client.get("/v1/bookings/bk_non_existent_99999")
    assert response.status_code == 404
    assert response.headers["Content-Type"] == "application/problem+json"
    problem_data = response.get_json()
    assert problem_data["title"] == "Not Found"
    assert "bk_non_existent_99999" in problem_data["detail"]