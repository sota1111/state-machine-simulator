import pytest
import hmac
import hashlib
import json
import os
from unittest.mock import MagicMock, patch
from google.api_core import exceptions as gexc
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

@pytest.fixture
def mock_gemini():
    # Patch the GenerativeModel constructor; the test drives the model instance's
    # generate_content via .return_value.
    with patch("google.generativeai.GenerativeModel") as mock_cls:
        # Avoid real network configuration calls.
        with patch("google.generativeai.configure"):
            yield mock_cls

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
    mock_model = mock_gemini.return_value

    mock_model.generate_content.side_effect = [
        gexc.ResourceExhausted("Rate limit"),
        _valid_response(),
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")

    assert result["name"] == "Test SM"
    assert mock_model.generate_content.call_count == 2
    assert mock_sleep.call_count == 1

def test_parse_retry_exhausted_rate_limit(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = gexc.ResourceExhausted("Rate limit")

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(AIRateLimitError) as excinfo:
            parse_natural_language("some text")

    assert "リクエスト制限" in str(excinfo.value)
    # Default retries = 3, so total calls = 1 + 3 = 4
    assert mock_model.generate_content.call_count == 4
    assert mock_sleep.call_count == 3

def test_parse_retry_success_after_500_error(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value

    mock_model.generate_content.side_effect = [
        gexc.InternalServerError("Server Error"),
        _valid_response(),
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")

    assert result["name"] == "Test SM"
    assert mock_model.generate_content.call_count == 2

def test_parse_retry_exhausted_500_error(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = gexc.InternalServerError("Server Error")

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(AIServiceUnavailableError) as excinfo:
            parse_natural_language("some text")

    assert "サーバーエラー" in str(excinfo.value)
    assert mock_model.generate_content.call_count == 4

def test_parse_no_retry_on_400_error(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = gexc.InvalidArgument("Bad Request")

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(RuntimeError) as excinfo:
            parse_natural_language("some text")

    assert "Gemini API error" in str(excinfo.value)
    assert mock_model.generate_content.call_count == 1
    assert mock_sleep.call_count == 0


def test_parse_retry_success_after_parse_failure(mock_gemini, mock_sleep):
    # 1st response is unparseable, 2nd is valid -> should retry and succeed
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = [
        _unparseable_response(),
        _valid_response(),
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")

    assert result["name"] == "Test SM"
    assert mock_model.generate_content.call_count == 2
    assert mock_sleep.call_count == 1


def test_parse_retry_exhausted_parse_failure(mock_gemini, mock_sleep):
    # All responses unparseable -> AIParseError after exhausting retries
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = [
        _unparseable_response() for _ in range(10)
    ]

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        with pytest.raises(AIParseError) as excinfo:
            parse_natural_language("some text")

    assert "読み取れませんでした" in str(excinfo.value)
    # Default retries = 3, so total calls = 1 + 3 = 4
    assert mock_model.generate_content.call_count == 4
    assert mock_sleep.call_count == 3


def test_router_handles_parse_error(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = [
        _unparseable_response() for _ in range(10)
    ]
    cookies = get_auth_cookie()
    client = TestClient(app)

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)

    assert response.status_code == 502
    assert "読み取れませんでした" in response.json()["detail"]


def test_router_handles_rate_limit_error(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = gexc.ResourceExhausted("Rate limit")
    cookies = get_auth_cookie()
    client = TestClient(app)

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)

    assert response.status_code == 429
    assert "リクエスト制限" in response.json()["detail"]

def test_router_handles_service_unavailable_error(mock_gemini, mock_sleep):
    mock_model = mock_gemini.return_value
    mock_model.generate_content.side_effect = gexc.InternalServerError("Server Error")
    cookies = get_auth_cookie()
    client = TestClient(app)

    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)

    assert response.status_code == 503
    assert "サーバーエラー" in response.json()["detail"]
