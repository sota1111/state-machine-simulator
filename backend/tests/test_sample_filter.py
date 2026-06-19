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


def _make_machine(db, *, name, is_sample):
    machine = StateMachine(
        name=name,
        description="",
        initial_state="S1",
        is_sample=is_sample,
    )
    db.add(machine)
    db.flush()
    db.add(State(machine_id=machine.id, name="S1"))
    db.add(State(machine_id=machine.id, name="S2", is_terminal=True))
    db.add(Transition(machine_id=machine.id, from_state="S1", to_state="S2", event="go"))
    db.commit()
    return machine.id


def test_is_sample_filter(client, auth_cookies):
    """GET /api/models/ supports filtering by is_sample, and the field is exposed."""
    db = SessionLocal()
    try:
        user_id = _make_machine(db, name=f"User Machine {uuid.uuid4()}", is_sample=False)
        sample_id = _make_machine(db, name=f"Sample Machine {uuid.uuid4()}", is_sample=True)
    finally:
        db.close()

    # is_sample=true -> only the sample
    resp = client.get("/api/models/?is_sample=true", cookies=auth_cookies)
    assert resp.status_code == 200, resp.text
    ids = {m["id"] for m in resp.json()}
    assert sample_id in ids
    assert user_id not in ids
    assert all(m["is_sample"] is True for m in resp.json())

    # is_sample=false -> only the user-created
    resp = client.get("/api/models/?is_sample=false", cookies=auth_cookies)
    assert resp.status_code == 200, resp.text
    ids = {m["id"] for m in resp.json()}
    assert user_id in ids
    assert sample_id not in ids
    assert all(m["is_sample"] is False for m in resp.json())

    # no param -> both present, and each item carries is_sample
    resp = client.get("/api/models/", cookies=auth_cookies)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    ids = {m["id"] for m in items}
    assert user_id in ids
    assert sample_id in ids
    assert all("is_sample" in m for m in items)
