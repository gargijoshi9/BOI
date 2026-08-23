# backend/app/services/audit_trail.py
import json
from pathlib import Path
from threading import Lock
from typing import List, Optional
from datetime import datetime

# Save audit log inside the backend directory
_AUDIT_LOG_PATH = Path(__file__).resolve().parent.parent.parent / "audit_trail.json"
_write_lock = Lock()

def _ensure_log_exists() -> None:
    if not _AUDIT_LOG_PATH.exists():
        _AUDIT_LOG_PATH.write_text("[]")

def record_decision(record: dict) -> dict:
    """Appends a single review decision to the JSON trail."""
    _ensure_log_exists()
    record["timestamp"] = datetime.utcnow().isoformat()
    
    with _write_lock:
        log = json.loads(_AUDIT_LOG_PATH.read_text())
        log.append(record)
        _AUDIT_LOG_PATH.write_text(json.dumps(log, indent=2))
        
    return record

def get_trail(account_id: Optional[str] = None) -> List[dict]:
    """Retrieves the audit trail, optionally filtered by account_id."""
    _ensure_log_exists()
    log = json.loads(_AUDIT_LOG_PATH.read_text())
    
    if account_id is not None:
        log = [r for r in log if r["account_id"] == account_id]
        
    # Return newest decisions first
    return sorted(log, key=lambda r: r["timestamp"], reverse=True)