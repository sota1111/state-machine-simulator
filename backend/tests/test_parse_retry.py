import pytest
import hmac
import hashlib
import os
from unittest.mock import MagicMock, patch
import anthropic
from app.services.nlp import parse_natural_language, AIRateLimitError, AIServiceUnavailableError
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
def mock_anthropic():
    with patch("anthropic.Anthropic") as mock:
        yield mock

@pytest.fixture
def mock_sleep():
    with patch("time.sleep") as mock:
        yield mock

def test_parse_retry_success_after_rate_limit(mock_anthropic, mock_sleep):
    # Setup mock to fail once then succeed
    mock_client = mock_anthropic.return_value
    
    # Create a mock response
    mock_response = MagicMock()
    mock_tool_use = MagicMock()
    mock_tool_use.type = "tool_use"
    mock_tool_use.name = "create_state_machine"
    mock_tool_use.input = {
        "name": "Test SM",
        "description": "desc",
        "initial_state": "S1",
        "states": [{"name": "S1"}],
        "transitions": []
    }
    mock_response.content = [mock_tool_use]
    
    # Mock side_effect: 1st call fails, 2nd succeeds
    mock_client.messages.create.side_effect = [
        anthropic.RateLimitError(message="Rate limit", response=MagicMock(), body={}),
        mock_response
    ]
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")
        
    assert result["name"] == "Test SM"
    assert mock_client.messages.create.call_count == 2
    assert mock_sleep.call_count == 1

def test_parse_retry_exhausted_rate_limit(mock_anthropic, mock_sleep):
    mock_client = mock_anthropic.return_value
    mock_client.messages.create.side_effect = anthropic.RateLimitError(
        message="Rate limit", response=MagicMock(), body={}
    )
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        with pytest.raises(AIRateLimitError) as excinfo:
            parse_natural_language("some text")
    
    assert "リクエスト制限" in str(excinfo.value)
    # Default retries = 3, so total calls = 1 + 3 = 4
    assert mock_client.messages.create.call_count == 4
    assert mock_sleep.call_count == 3

def test_parse_retry_success_after_500_error(mock_anthropic, mock_sleep):
    mock_client = mock_anthropic.return_value
    
    mock_response = MagicMock()
    mock_tool_use = MagicMock()
    mock_tool_use.type = "tool_use"
    mock_tool_use.name = "create_state_machine"
    mock_tool_use.input = {
        "name": "Test SM",
        "initial_state": "S1",
        "states": [{"name": "S1"}],
        "transitions": []
    }
    mock_response.content = [mock_tool_use]
    
    # 500 error
    mock_500 = anthropic.APIStatusError(message="Server Error", response=MagicMock(status_code=500), body={})
    
    mock_client.messages.create.side_effect = [mock_500, mock_response]
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        result = parse_natural_language("some text")
        
    assert result["name"] == "Test SM"
    assert mock_client.messages.create.call_count == 2

def test_parse_retry_exhausted_500_error(mock_anthropic, mock_sleep):
    mock_client = mock_anthropic.return_value
    mock_500 = anthropic.APIStatusError(message="Server Error", response=MagicMock(status_code=500), body={})
    mock_client.messages.create.side_effect = mock_500
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        with pytest.raises(AIServiceUnavailableError) as excinfo:
            parse_natural_language("some text")
            
    assert "サーバーエラー" in str(excinfo.value)
    assert mock_client.messages.create.call_count == 4

def test_parse_no_retry_on_400_error(mock_anthropic, mock_sleep):
    mock_client = mock_anthropic.return_value
    mock_400 = anthropic.APIStatusError(message="Bad Request", response=MagicMock(status_code=400), body={})
    mock_client.messages.create.side_effect = mock_400
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        with pytest.raises(RuntimeError) as excinfo:
            parse_natural_language("some text")
            
    assert "Claude API error" in str(excinfo.value)
    assert mock_client.messages.create.call_count == 1
    assert mock_sleep.call_count == 0

def test_router_handles_rate_limit_error(mock_anthropic, mock_sleep):
    mock_client = mock_anthropic.return_value
    mock_client.messages.create.side_effect = anthropic.RateLimitError(
        message="Rate limit", response=MagicMock(), body={}
    )
    cookies = get_auth_cookie()
    client = TestClient(app)
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)
        
    assert response.status_code == 429
    assert "リクエスト制限" in response.json()["detail"]

def test_router_handles_service_unavailable_error(mock_anthropic, mock_sleep):
    mock_client = mock_anthropic.return_value
    mock_500 = anthropic.APIStatusError(message="Server Error", response=MagicMock(status_code=500), body={})
    mock_client.messages.create.side_effect = mock_500
    cookies = get_auth_cookie()
    client = TestClient(app)
    
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fake_key"}):
        response = client.post("/api/parse/", json={"text": "some text"}, cookies=cookies)
        
    assert response.status_code == 503
    assert "サーバーエラー" in response.json()["detail"]
