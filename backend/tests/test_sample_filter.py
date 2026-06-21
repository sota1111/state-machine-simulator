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
    token = hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
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


def _make_machine(repo, *, name, is_sample):
    if is_sample:
        # Samples are inserted via the seed path (is_sample=True).
        repo.seed_samples([{
            "name": name,
            "description": "",
            "initial_state": "S1",
            "states": [{"name": "S1"}, {"name": "S2", "is_terminal": True}],
            "transitions": [{"from_state": "S1", "to_state": "S2", "event": "go"}],
        }])
        return next(m.id for m in repo.list(is_sample=True) if m.name == name)

    from app.schemas import StateMachineCreate, StateCreate, TransitionCreate
    created = repo.create(StateMachineCreate(
        name=name,
        description="",
        initial_state="S1",
        states=[StateCreate(name="S1"), StateCreate(name="S2", is_terminal=True)],
        transitions=[TransitionCreate(from_state="S1", to_state="S2", event="go")],
    ))
    return created.id


def test_is_sample_filter(client, repo, auth_cookies):
    """GET /api/models/ supports filtering by is_sample, and the field is exposed."""
    user_id = _make_machine(repo, name=f"User Machine {uuid.uuid4()}", is_sample=False)
    sample_id = _make_machine(repo, name=f"Sample Machine {uuid.uuid4()}", is_sample=True)

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
