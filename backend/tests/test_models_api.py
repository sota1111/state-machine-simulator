import os
import hmac
import hashlib
import uuid

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("APP_ENV", "test")

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import StateMachine, State, Transition

_APP_NAME = "state-machine-simulator"


def get_auth_cookie():
    secret = os.getenv("AUTH_SECRET")
    token = hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    return {"auth_token": token}


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_cookies():
    return get_auth_cookie()


def test_list_models_with_null_description(client, auth_cookies):
    """Regression for SOT-817: a state/machine with a NULL description column
    must not cause GET /api/models/ to fail with a 500 ResponseValidationError.
    """
    db = SessionLocal()
    try:
        machine = StateMachine(
            name=f"NullDesc Machine {uuid.uuid4()}",
            description=None,  # NULL machine description
            initial_state="S1",
        )
        db.add(machine)
        db.flush()
        db.add(State(machine_id=machine.id, name="S1", description=None))  # NULL state description
        db.add(State(machine_id=machine.id, name="S2", description=None, is_terminal=True))
        db.add(Transition(machine_id=machine.id, from_state="S1", to_state="S2", event="go"))
        db.commit()
        machine_id = machine.id
    finally:
        db.close()

    resp = client.get("/api/models/", cookies=auth_cookies)
    assert resp.status_code == 200, resp.text

    models = resp.json()
    target = next((m for m in models if m["id"] == machine_id), None)
    assert target is not None
    # NULL descriptions are normalized to empty strings, not null.
    assert target["description"] == ""
    assert all(s["description"] == "" for s in target["states"])
