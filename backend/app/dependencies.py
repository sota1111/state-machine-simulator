import os
import hmac
import hashlib
from typing import Iterator
from fastapi import Cookie, HTTPException, status
from .repositories.base import StateMachineRepository

_APP_NAME = "state-machine-simulator"

def get_current_user(auth_token: str = Cookie(None)) -> str:
    auth_secret = os.getenv("AUTH_SECRET")
    if not auth_secret or not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    expected = hmac.new(
        auth_secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(auth_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    return "authenticated"

def get_repository() -> Iterator[StateMachineRepository]:
    app_env = os.getenv("APP_ENV", "local")
    if app_env == "production":
        from .repositories.firestore_repository import FirestoreStateMachineRepository
        yield FirestoreStateMachineRepository()
    else:
        from .repositories.memory_repository import get_memory_repository
        yield get_memory_repository()
