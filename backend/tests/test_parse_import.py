import os
import hmac
import hashlib

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("APP_ENV", "test")
# Ensure no AI client is configured so import uses the deterministic heuristic.
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("GOOGLE_API_KEY", None)
os.environ.pop("GOOGLE_GENAI_USE_VERTEXAI", None)

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.nlp import heuristic_extract, import_flow

_APP_NAME = "state-machine-simulator"


def get_auth_cookie():
    secret = os.getenv("AUTH_SECRET")
    token = hmac.new(secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256).hexdigest()
    return {"auth_token": token}


@pytest.fixture
def client():
    return TestClient(app)


def test_heuristic_extract_from_arrows():
    text = """
    Idle --[start]--> Running
    Running --[finish]--> Done
    Running -> Failed : error
    """
    result = heuristic_extract(text)
    names = {s["name"] for s in result["states"]}
    assert names == {"Idle", "Running", "Done", "Failed"}
    assert result["initial_state"] == "Idle"
    # Done and Failed have no outgoing edges -> terminal.
    terminal = {s["name"] for s in result["states"] if s["is_terminal"]}
    assert terminal == {"Done", "Failed"}
    assert "start" in result["events"]


def test_heuristic_extract_from_numbered_steps():
    text = """
    1. Receive order
    2. Pack items
    3. Ship order
    """
    result = heuristic_extract(text)
    assert result["initial_state"] == "Receive order"
    assert len(result["states"]) == 3
    assert len(result["transitions"]) == 2
    assert all(tr["event"] == "next" for tr in result["transitions"])


def test_heuristic_extract_empty_raises():
    with pytest.raises(ValueError):
        heuristic_extract("   \n   ")


def test_import_flow_uses_heuristic_without_ai():
    result = import_flow("A -> B\nB -> C", source_type="code")
    assert result["initial_state"] == "A"
    assert len(result["transitions"]) == 2


def test_import_endpoint(client):
    resp = client.post(
        "/api/parse/import",
        json={"text": "Idle --[go]--> Active\nActive --[stop]--> Idle", "source_type": "auto"},
        cookies=get_auth_cookie(),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["initial_state"] == "Idle"
    assert {s["name"] for s in body["states"]} == {"Idle", "Active"}


def test_import_endpoint_empty_text(client):
    resp = client.post("/api/parse/import", json={"text": "  "}, cookies=get_auth_cookie())
    assert resp.status_code == 400
