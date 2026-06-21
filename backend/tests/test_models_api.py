import os
import hmac
import hashlib
import uuid
from datetime import datetime, timezone

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
    token = hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    return {"auth_token": token}


@pytest.fixture
def repo():
    """Fresh, isolated in-memory repository wired into the app per test."""
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


def test_list_models_with_null_description(client, repo, auth_cookies):
    """Regression for SOT-817: a state/machine with a NULL description must not
    cause GET /api/models/ to fail with a 500 ResponseValidationError. NULL
    descriptions are normalized to empty strings by the response schema.
    """
    machine_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    # Inject a doc carrying NULL descriptions directly into the store.
    repo._store[machine_id] = {
        "id": machine_id,
        "name": f"NullDesc Machine {uuid.uuid4()}",
        "description": None,  # NULL machine description
        "initial_state": "S1",
        "states": [
            {"id": str(uuid.uuid4()), "name": "S1", "description": None, "is_terminal": False, "parent": None},
            {"id": str(uuid.uuid4()), "name": "S2", "description": None, "is_terminal": True, "parent": None},
        ],
        "transitions": [
            {"id": str(uuid.uuid4()), "from_state": "S1", "to_state": "S2", "event": "go"},
        ],
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
        "is_sample": False,
    }

    resp = client.get("/api/models/", cookies=auth_cookies)
    assert resp.status_code == 200, resp.text

    models = resp.json()
    target = next((m for m in models if m["id"] == machine_id), None)
    assert target is not None
    # NULL descriptions are normalized to empty strings, not null.
    assert target["description"] == ""
    assert all(s["description"] == "" for s in target["states"])


def test_models_crud_flow(client, auth_cookies):
    """Create -> get -> update -> delete round-trip through the API."""
    payload = {
        "name": f"CRUD Machine {uuid.uuid4()}",
        "description": "desc",
        "initial_state": "S1",
        "states": [
            {"name": "S1", "description": "start"},
            {"name": "S2", "description": "end", "is_terminal": True},
        ],
        "transitions": [
            {"from_state": "S1", "to_state": "S2", "event": "go"},
        ],
    }
    create = client.post("/api/models/", json=payload, cookies=auth_cookies)
    assert create.status_code == 200, create.text
    machine_id = create.json()["id"]

    got = client.get(f"/api/models/{machine_id}", cookies=auth_cookies)
    assert got.status_code == 200
    assert got.json()["name"] == payload["name"]

    payload["name"] = payload["name"] + " (edited)"
    upd = client.put(f"/api/models/{machine_id}", json=payload, cookies=auth_cookies)
    assert upd.status_code == 200
    assert upd.json()["name"].endswith("(edited)")

    delete = client.delete(f"/api/models/{machine_id}", cookies=auth_cookies)
    assert delete.status_code == 200

    gone = client.get(f"/api/models/{machine_id}", cookies=auth_cookies)
    assert gone.status_code == 404
