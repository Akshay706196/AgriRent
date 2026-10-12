"""
Isolated In-Process Storage for Booking Service (Task C1).
No other microservice is permitted to import or manipulate this dictionary.
"""

class BookingStore:
    def __init__(self):
        # Maps public_id -> BookingRecord
        self._records = {}
        # Maps idempotency_key -> { "response": dict, "status_code": int, "headers": dict }
        self._idempotency_cache = {}

    def save(self, record):
        self._records[record.public_id] = record
        return record

    def get_by_id(self, booking_id: str):
        return self._records.get(booking_id)

    def list_all(self, status_filter: str = None):
        items = list(self._records.values())
        if status_filter:
            items = [item for item in items if item.status == status_filter]
        return items

    def has_conflict(self, equipment_id: str, start_date: str, end_date: str) -> bool:
        """Checks for date overlapping conflicts on the same piece of equipment."""
        for item in self._records.values():
            if item.equipment_id == equipment_id and item.status != "CANCELLED":
                # Overlap logic: start_a < end_b AND end_a > start_b
                if item.start_date < end_date and item.end_date > start_date:
                    return True
        return False

    def get_idempotent_response(self, key: str):
        return self._idempotency_cache.get(key)

    def save_idempotent_response(self, key: str, payload: dict, status_code: int, headers: dict = None):
        self._idempotency_cache[key] = {
            "payload": payload,
            "status_code": status_code,
            "headers": headers or {}
        }

# Global singleton storage instance for this service
store = BookingStore()