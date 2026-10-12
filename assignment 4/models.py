import uuid
from datetime import datetime, date

class BookingRecord:
    def __init__(self, renter_id: str, equipment_id: str, start_date: str, end_date: str, 
                 rental_rate_per_day: float, idempotency_key: str = None):
        self.internal_db_id = str(uuid.uuid4())   # Internal DB surrogate key (never exposed)
        self.public_id = f"bk_{uuid.uuid4().hex[:8]}"  # Public external ID
        self.renter_id = renter_id
        self.equipment_id = equipment_id
        self.start_date = start_date
        self.end_date = end_date
        self.rental_rate_per_day = float(rental_rate_per_day)
        self.status = "PENDING"
        self.cancellation_reason = None
        self.created_at = datetime.utcnow().isoformat()
        self.idempotency_key = idempotency_key
        
        # Internal auditing field (strictly forbidden from leaking into public responses)
        self._internal_audit_token = f"audit_{uuid.uuid4().hex}"

        # Calculate duration
        d1 = datetime.strptime(start_date, "%Y-%m-%d").date()
        d2 = datetime.strptime(end_date, "%Y-%m-%d").date()
        self.total_days = (d2 - d1).days
        self.total_cost = round(self.total_days * self.rental_rate_per_day, 2)

    def as_json(self) -> dict:
        """
        Public external representation. 
        Differs from internal record: hides internal_db_id and _internal_audit_token.
        """
        return {
            "id": self.public_id,
            "renter_id": self.renter_id,
            "equipment_id": self.equipment_id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "total_days": self.total_days,
            "total_cost": self.total_cost,
            "status": self.status,
            "cancellation_reason": self.cancellation_reason
        }