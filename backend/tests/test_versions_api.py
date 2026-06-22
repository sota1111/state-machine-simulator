import os
import hmac
import hashlib
import uuid

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("APP_ENV", "test")

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_repository
from app.repositories.memory_repository import InMemoryStateMachineRepository

_APP_NAME = "state-machine-simulator"


def get_auth_cookie():
    secret = os.getenv("AUTH_SECRET")
    token = hmac.new(secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256).hexdigest()
    return {"auth_token": token}


@pytest.fixture
def repo():
    instance = InMemoryStateMachineRepository(store={}, history={})
    app.dependency_overrides[get_repository] = lambda: instance
    yield instance
    app.dependency_overrides.pop(get_repository, None)


@pytest.fixture
def client(repo):
    return TestClient(app)


@pytest.fixture
def auth_cookies():
    return get_auth_cookie()


def _payload(name, extra_state=False):
    states = [
        {"name": "S1", "description": "start"},
        {"name": "S2", "description": "end", "is_terminal": True},
    ]
    transitions = [{"from_state": "S1", "to_state": "S2", "event": "go"}]
    if extra_state:
        states.append({"name": "S3", "description": "extra", "is_terminal": True})
        transitions.append({"from_state": "S1", "to_state": "S3", "event": "branch"})
    return {
        "name": name,
        "description": "desc",
        "initial_state": "S1",
        "states": states,
        "transitions": transitions,
    }


def test_versions_empty_before_update(client, auth_cookies):
    create = client.post("/api/models/", json=_payload(f"V {uuid.uuid4()}"), cookies=auth_cookies)
    mid = create.json()["id"]
    versions = client.get(f"/api/models/{mid}/versions", cookies=auth_cookies)
    assert versions.status_code == 200
    assert versions.json() == []


def test_update_accumulates_versions_and_diff(client, auth_cookies):
    create = client.post("/api/models/", json=_payload(f"V {uuid.uuid4()}"), cookies=auth_cookies)
    mid = create.json()["id"]

    # First edit -> snapshot of the original is stored as version 1.
    client.put(f"/api/models/{mid}", json=_payload("edited", extra_state=True), cookies=auth_cookies)
    # Second edit -> snapshot of the (edited, extra_state) is stored as version 2.
    client.put(f"/api/models/{mid}", json=_payload("edited again"), cookies=auth_cookies)

    versions = client.get(f"/api/models/{mid}/versions", cookies=auth_cookies)
    assert versions.status_code == 200
    body = versions.json()
    assert [v["version"] for v in body] == [2, 1]  # newest first

    v1 = client.get(f"/api/models/{mid}/versions/1", cookies=auth_cookies)
    assert v1.status_code == 200
    assert {s["name"] for s in v1.json()["states"]} == {"S1", "S2"}

    v2 = client.get(f"/api/models/{mid}/versions/2", cookies=auth_cookies)
    assert {s["name"] for s in v2.json()["states"]} == {"S1", "S2", "S3"}


def test_version_404(client, auth_cookies):
    create = client.post("/api/models/", json=_payload(f"V {uuid.uuid4()}"), cookies=auth_cookies)
    mid = create.json()["id"]
    missing = client.get(f"/api/models/{mid}/versions/99", cookies=auth_cookies)
    assert missing.status_code == 404
    no_machine = client.get("/api/models/does-not-exist/versions", cookies=auth_cookies)
    assert no_machine.status_code == 404
