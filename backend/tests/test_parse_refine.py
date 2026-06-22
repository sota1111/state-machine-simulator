import hashlib
import hmac
import os

from fastapi.testclient import TestClient

from app.main import app


os.environ["AUTH_SECRET"] = "test-secret"
os.environ["APP_ENV"] = "test"
_APP_NAME = "state-machine-simulator"


def get_auth_cookie():
    secret = os.getenv("AUTH_SECRET", "test-secret")
    token = hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    return {"auth_token": token}


def _request_payload(instruction="Add a Review state"):
    return {
        "instruction": instruction,
        "name": "Order",
        "description": "Order workflow",
        "initial_state": "Draft",
        "states": [{"name": "Draft"}],
        "transitions": [],
    }


def test_refine_success(monkeypatch):
    client = TestClient(app)
    cookies = get_auth_cookie()
    refined = {
        "name": "Order",
        "description": "Order workflow with review",
        "initial_state": "Draft",
        "states": [{"name": "Draft"}, {"name": "Review"}],
        "transitions": [
            {"from_state": "Draft", "to_state": "Review", "event": "submit"}
        ],
    }

    def mock_refine_state_machine(current, instruction):
        assert current["name"] == "Order"
        assert instruction == "Add a Review state"
        return refined

    monkeypatch.setattr(
        "app.routers.parse.refine_state_machine", mock_refine_state_machine
    )

    response = client.post(
        "/api/parse/refine", json=_request_payload(), cookies=cookies
    )

    assert response.status_code == 200
    # The router adds an `events` field (defaults to [] when the mock bypasses
    # _parse_response, which is where events are normally derived). SOT-1095.
    assert response.json() == {**refined, "events": []}


def test_refine_empty_instruction_returns_400(monkeypatch):
    client = TestClient(app)
    cookies = get_auth_cookie()

    def mock_refine_state_machine(current, instruction):
        raise AssertionError("refine_state_machine should not be called")

    monkeypatch.setattr(
        "app.routers.parse.refine_state_machine", mock_refine_state_machine
    )

    response = client.post(
        "/api/parse/refine", json=_request_payload("   "), cookies=cookies
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Instruction cannot be empty"


def test_refine_empty_states_returns_400(monkeypatch):
    client = TestClient(app)
    cookies = get_auth_cookie()
    payload = _request_payload()
    payload["states"] = []

    def mock_refine_state_machine(current, instruction):
        raise AssertionError("refine_state_machine should not be called")

    monkeypatch.setattr(
        "app.routers.parse.refine_state_machine", mock_refine_state_machine
    )

    response = client.post("/api/parse/refine", json=payload, cookies=cookies)

    assert response.status_code == 400
    assert response.json()["detail"] == "Current workflow has no states to refine"


class _FakeResponse:
    """Minimal stand-in for a google-genai response (only `.text` is used)."""

    def __init__(self, text):
        self.text = text


def test_parse_response_derives_unique_events():
    """_parse_response derives a de-duplicated, first-seen-ordered event list
    from the transitions (SOT-1095)."""
    import json as _json

    from app.services.nlp import _parse_response

    payload = {
        "name": "Order",
        "initial_state": "Draft",
        "states": [
            {"name": "Draft"},
            {"name": "Review"},
            {"name": "Done"},
        ],
        "transitions": [
            {"from_state": "Draft", "to_state": "Review", "event": "submit"},
            {"from_state": "Review", "to_state": "Draft", "event": "reject"},
            {"from_state": "Review", "to_state": "Done", "event": "submit"},
            {"from_state": "Done", "to_state": "Done", "event": ""},
        ],
    }

    result = _parse_response(_FakeResponse(_json.dumps(payload)))

    # "submit" appears twice but is listed once; first-seen order preserved;
    # the blank event is excluded.
    assert result["events"] == ["submit", "reject"]
