import os
from fastapi.testclient import TestClient

# Ensure test environment before importing the app/router.
os.environ["AUTH_SECRET"] = "test-secret"
os.environ["FIREBASE_API_KEY"] = "test-api-key"
os.environ["APP_ENV"] = "test"
os.environ["ALLOWED_USER_EMAILS"] = ""

from app.main import app
from app.routers import auth as auth_router


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_login_success_sets_cookie(monkeypatch):
    def fake_post(url, params=None, json=None, timeout=None):
        # The password must never be logged; we just assert it is passed through.
        assert json["email"] == "user@example.com"
        assert json["password"] == "correct-password"
        return _FakeResponse(200, {"email": "user@example.com", "idToken": "x"})

    monkeypatch.setattr(auth_router.requests, "post", fake_post)

    client = TestClient(app)
    res = client.post(
        "/api/auth/session",
        json={"email": "user@example.com", "password": "correct-password"},
    )

    assert res.status_code == 200
    assert res.json()["success"] is True
    assert "auth_token" in res.cookies


def test_login_invalid_credentials_returns_401(monkeypatch):
    def fake_post(url, params=None, json=None, timeout=None):
        return _FakeResponse(400, {"error": {"message": "INVALID_LOGIN_CREDENTIALS"}})

    monkeypatch.setattr(auth_router.requests, "post", fake_post)

    client = TestClient(app)
    res = client.post(
        "/api/auth/session",
        json={"email": "user@example.com", "password": "wrong"},
    )

    assert res.status_code == 401
    assert "auth_token" not in res.cookies


def test_login_too_many_attempts_returns_429(monkeypatch):
    def fake_post(url, params=None, json=None, timeout=None):
        return _FakeResponse(
            400, {"error": {"message": "TOO_MANY_ATTEMPTS_TRY_LATER : retry later"}}
        )

    monkeypatch.setattr(auth_router.requests, "post", fake_post)

    client = TestClient(app)
    res = client.post(
        "/api/auth/session",
        json={"email": "user@example.com", "password": "wrong"},
    )

    assert res.status_code == 429
