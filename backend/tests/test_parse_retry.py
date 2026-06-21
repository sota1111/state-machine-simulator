import pytest
import hmac
import hashlib
import json
import os
from unittest.mock import MagicMock, patch
from google.genai import errors as gerrors
from app.services.nlp import parse_natural_language, AIRateLimitError, AIServiceUnavailableError, AIParseError
from fastapi.testclient import TestClient
from app.main import app

# Mock settings for testing
os.environ["AUTH_SECRET"] = "test-secret"
os.environ["APP_ENV"] = "test"
_APP_NAME = "state-machine-simulator"

def get_auth_cookie():
    secret = os.getenv("AUTH_SECRET", "test-secret")
    token = hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    return {"auth_token": token}


def _make_api_error(cls, code, message):
    # Build a google-genai error WITHOUT calling its __init__: the constructor
    # signature/internals differ across SDK versions (older versions accept a
    # response_json dict, newer ones expect a response object with body_segments).
    # nlp.py only relies on isinstance(...) and ``.code`` / ``str(e)``, so we set
    # those attributes directly to stay version-agnostic.
    err = cls.__new__(cls)
    err.code = code
    err.message = message
    err.status = None
    err.response = None
    err.details = None
    err.args = (f"{code} {message}",)
    return err


def _client_error(code, message):
    return _make_api_error(gerrors.ClientError, code, message)


def _server_error(code, message):
    return _make_api_error(gerrors.ServerError, code, message)


@pytest.fixture
def mock_gemini():
    # Patch the shared client factory; the test drives the Vertex AI client's
    # models.generate_content via the returned mock's .side_effect / .return_value.
    mock_client = MagicMock()
    with patch("app.services.nlp.get_genai_client", return_value=mock_client):
        yield mock_client.models.generate_content

@pytest.fixture
def mock_sleep():
    with patch("time.sleep") as mock:
        yield mock

def _valid_response(name="Test SM"):
    return MagicMock(text=json.dumps({
        "name": name,
        "description": "desc",
        "initial_state": "S1",
        "states": [{"name": "S1"}],
        "transitions": []
    }))

def _unparseable_response():
    # Not valid JSON -> json.loads raises (ValueError) -> parse-retry path
    return MagicMock(text="not json at all")

def test_parse_retry_success_after_rate_limit(mock_gemini, mock_sleep):
    # Setup mock to fail once (rate limit) then succeed
    mock_gemini.side_effect = [
        _client_error(429, "Rate limit"),
        _valid_response(),
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")

    assert result["name"] == "Test SM"
    assert mock_gemini.call_count == 2
    assert mock_sleep.call_count == 1

def test_parse_retry_exhausted_rate_limit(mock_gemini, mock_sleep):
    mock_gemini.side_effect = _client_error(429, "Rate limit")

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(AIRateLimitError) as excinfo:
            parse_natural_language("some text")

    assert "リクエスト制限" in str(excinfo.value)
    # Default retries = 3, so total calls = 1 + 3 = 4
    assert mock_gemini.call_count == 4
    assert mock_sleep.call_count == 3

def test_parse_retry_success_after_500_error(mock_gemini, mock_sleep):
    mock_gemini.side_effect = [
        _server_error(500, "Server Error"),
        _valid_response(),
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")

    assert result["name"] == "Test SM"
    assert mock_gemini.call_count == 2

def test_parse_retry_exhausted_500_error(mock_gemini, mock_sleep):
    mock_gemini.side_effect = _server_error(500, "Server Error")

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(AIServiceUnavailableError) as excinfo:
            parse_natural_language("some text")

    assert "サーバーエラー" in str(excinfo.value)
    assert mock_gemini.call_count == 4

def test_parse_no_retry_on_400_error(mock_gemini, mock_sleep):
    mock_gemini.side_effect = _client_error(400, "Bad Request")

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(RuntimeError) as excinfo:
            parse_natural_language("some text")

    assert "Gemini API error" in str(excinfo.value)
    assert mock_gemini.call_count == 1
    assert mock_sleep.call_count == 0


def test_parse_retry_success_after_parse_failure(mock_gemini, mock_sleep):
    # 1st response is unparseable, 2nd is valid -> should retry and succeed
    mock_gemini.side_effect = [
        _unparseable_response(),
        _valid_response(),
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")

    assert result["name"] == "Test SM"
    assert mock_gemini.call_count == 2
    assert mock_sleep.call_count == 1


def test_parse_retry_exhausted_parse_failure(mock_gemini, mock_sleep):
    # All responses unparseable -> AIParseError after exhausting retries
    mock_gemini.side_effect = [
        _unparseable_response() for _ in range(10)
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(AIParseError) as excinfo:
            parse_natural_language("some text")

    assert "読み取れませんでした" in str(excinfo.value)
    # Default retries = 3, so total calls = 1 + 3 = 4
    assert mock_gemini.call_count == 4
    assert mock_sleep.call_count == 3


def test_router_handles_parse_error(mock_gemini, mock_sleep):
    mock_gemini.side_effect = [
        _unparseable_response() for _ in range(10)
    ]
    cookies = get_auth_cookie()
    client = TestClient(app)

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)

    assert response.status_code == 502
    assert "読み取れませんでした" in response.json()["detail"]


def test_router_handles_rate_limit_error(mock_gemini, mock_sleep):
    mock_gemini.side_effect = _client_error(429, "Rate limit")
    cookies = get_auth_cookie()
    client = TestClient(app)

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)

    assert response.status_code == 429
    assert "リクエスト制限" in response.json()["detail"]

def test_router_handles_service_unavailable_error(mock_gemini, mock_sleep):
    mock_gemini.side_effect = _server_error(500, "Server Error")
    cookies = get_auth_cookie()
    client = TestClient(app)

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)

    assert response.status_code == 503
    assert "サーバーエラー" in response.json()["detail"]
