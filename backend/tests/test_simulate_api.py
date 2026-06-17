import pytest
import os
import hmac
import hashlib
import uuid
from fastapi.testclient import TestClient
from app.main import app

# Ensure test environment
os.environ["AUTH_SECRET"] = "test-secret"
os.environ["APP_ENV"] = "test"
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

def test_simulate_api_flow(client, auth_cookies):
    # 1. Create a model
    model_data = {
        "name": f"API Test Machine {uuid.uuid4()}",
        "description": "Test simulation through API",
        "initial_state": "S1",
        "states": [
            {"name": "S1", "description": "Start"},
            {"name": "S2", "description": "End", "is_terminal": True}
        ],
        "transitions": [
            {"from_state": "S1", "to_state": "S2", "event": "go"}
        ]
    }
    create_resp = client.post("/api/models/", json=model_data, cookies=auth_cookies)
    assert create_resp.status_code == 200
    machine_id = create_resp.json()["id"]

    # 2. Simulate success
    sim_resp = client.post(f"/api/models/{machine_id}/simulate", json={"current_state": "S1", "event": "go"}, cookies=auth_cookies)
    assert sim_resp.status_code == 200
    data = sim_resp.json()
    assert data["success"] is True
    assert data["next_state"] == "S2"
    assert "Transition executed" in data["message"]

    # 3. Simulate failure (no transition)
    sim_resp = client.post(f"/api/models/{machine_id}/simulate", json={"current_state": "S1", "event": "stay"}, cookies=auth_cookies)
    assert sim_resp.status_code == 200
    data = sim_resp.json()
    assert data["success"] is False
    assert data["next_state"] is None
    assert "No transition defined" in data["message"]

    # 4. Check history
    hist_resp = client.get(f"/api/models/{machine_id}/history", cookies=auth_cookies)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 2
    # History is ordered by executed_at desc, so the second simulation (failure) should be first
    assert history[0]["steps"][0]["event"] == "stay"
    assert history[0]["steps"][0]["success"] is False
    assert history[1]["steps"][0]["event"] == "go"
    assert history[1]["steps"][0]["success"] is True

def test_simulate_api_404(client, auth_cookies):
    # Non-existent ID
    bad_id = "non-existent-id"
    sim_resp = client.post(f"/api/models/{bad_id}/simulate", json={"current_state": "S1", "event": "go"}, cookies=auth_cookies)
    assert sim_resp.status_code == 404
    
    hist_resp = client.get(f"/api/models/{bad_id}/history", cookies=auth_cookies)
    assert hist_resp.status_code == 404

def test_simulate_api_unauthorized(client):
    # No cookies
    sim_resp = client.post("/api/models/any-id/simulate", json={"current_state": "S1", "event": "go"})
    assert sim_resp.status_code == 401
