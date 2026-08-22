"""
Audit Trail + Case Action System for MuleRadar
================================================
Tracks investigator actions (freeze, escalate, dismiss, unfreeze)
with timestamps and analyst attribution. Persisted to audit_trail.json.

This directly addresses PMLA Section 12 compliance requirements.
"""

import json
import time
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel, Field


AUDIT_LOG_PATH = Path(__file__).resolve().parent.parent.parent.parent / "audit_trail.json"


class ActionRequest(BaseModel):
    action: str = Field(..., pattern="^(freeze|escalate|dismiss|unfreeze)$")
    note: Optional[str] = Field(default="", max_length=500)
    analyst: Optional[str] = "investigator"


class ActionRecord(BaseModel):
    account_id: str
    action: str
    note: str
    analyst: str
    timestamp: float
    risk_score_at_action: Optional[int] = None


class AuditTrail:
    """Persistent audit trail for case management actions."""

    def __init__(self, log_path: Path = AUDIT_LOG_PATH):
        self.log_path = log_path
        if not self.log_path.exists():
            self.log_path.write_text("[]")

    def _read(self) -> list:
        try:
            return json.loads(self.log_path.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write(self, records: list):
        self.log_path.write_text(json.dumps(records, indent=2))

    def record_action(
        self,
        account_id: str,
        action: str,
        analyst: str = "investigator",
        note: str = "",
        risk_score: Optional[int] = None,
    ) -> dict:
        entry = {
            "account_id": str(account_id),
            "action": action,
            "note": note,
            "analyst": analyst,
            "timestamp": time.time(),
            "risk_score_at_action": risk_score,
        }
        records = self._read()
        records.append(entry)
        self._write(records)
        return entry

    def get_trail(self, account_id: Optional[str] = None, limit: int = 100) -> list:
        records = self._read()
        if account_id is not None:
            records = [r for r in records if str(r["account_id"]) == str(account_id)]
        # Most recent first
        records.sort(key=lambda r: r["timestamp"], reverse=True)
        return records[:limit]

    def get_latest_action(self, account_id: str) -> Optional[dict]:
        """Get the most recent action for an account (for status display)."""
        records = self.get_trail(account_id=account_id, limit=1)
        return records[0] if records else None

    def get_account_status(self, account_id: str) -> str:
        """Derive current account status from action history."""
        trail = self.get_trail(account_id=account_id, limit=50)
        for record in trail:
            action = record["action"]
            if action == "freeze":
                return "frozen"
            elif action == "unfreeze":
                return "active"
            elif action == "escalate":
                return "escalated"
            elif action == "dismiss":
                return "dismissed"
        return "active"


# Global instance
audit_trail = AuditTrail()
