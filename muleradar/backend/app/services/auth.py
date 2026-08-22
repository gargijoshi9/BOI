"""
Simple Session Authentication for MuleRadar
=============================================
Demo-grade auth: login with username/password, get a Bearer token.
Actions (freeze/escalate/dismiss) require a valid session.

For hackathon demo purposes. Production would use the bank's SSO/OAuth2.
"""

import hashlib
import secrets
import time
from typing import Optional
from pydantic import BaseModel


def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# Demo users
_DEMO_USERS = {
    "analyst": {
        "password_hash": _hash_pw("mule123"),
        "display_name": "AML Analyst",
        "role": "Analyst",
    },
    "admin": {
        "password_hash": _hash_pw("mule123"),
        "display_name": "Compliance Officer",
        "role": "Admin",
    },
}

# In-memory sessions: token -> {username, display_name, role, issued_at}
_SESSIONS: dict[str, dict] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    display_name: str
    role: str


class SessionUser(BaseModel):
    username: str
    display_name: str
    role: str


def login(username: str, password: str) -> Optional[LoginResponse]:
    user = _DEMO_USERS.get(username.lower())
    if not user or user["password_hash"] != _hash_pw(password):
        return None
    token = secrets.token_hex(24)
    _SESSIONS[token] = {
        "username": username.lower(),
        "display_name": user["display_name"],
        "role": user["role"],
        "issued_at": time.time(),
    }
    return LoginResponse(
        token=token,
        username=username.lower(),
        display_name=user["display_name"],
        role=user["role"],
    )


def logout(token: str) -> bool:
    return _SESSIONS.pop(token, None) is not None


def get_user(token: str) -> Optional[SessionUser]:
    session = _SESSIONS.get(token)
    if not session:
        return None
    return SessionUser(
        username=session["username"],
        display_name=session["display_name"],
        role=session["role"],
    )


def validate_token(authorization: Optional[str]) -> Optional[SessionUser]:
    """Extract and validate Bearer token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return get_user(token)
