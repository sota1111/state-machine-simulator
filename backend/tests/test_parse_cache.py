import pytest
import hmac
import hashlib
import os
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.services.cache import parse_cache

# Mock settings for testing
os.environ["AUTH_SECRET"] = "test-secret"
os.environ["APP_ENV"] = "test"
_APP_NAME = "state-machine-simulator"

def get_auth_cookie():
    secret = os.getenv("AUTH_SECRET")
    token = hmac.new(
        secret.encode(), f"{_APP_NAME}-auth".encode(), hashlib.sha256
    ).hexdigest()
    return {"auth_token": token}

@pytest.fixture(autouse=True)
def clear_cache():
    parse_cache.clear()
    yield

def test_parse_cache_hit():
    client = TestClient(app)
    cookies = get_auth_cookie()
    
    input_text = "Simple lamp: Off -> On with 'flip'"
    mock_result = {
        "name": "Lamp",
        "description": "A simple lamp",
        "initial_state": "Off",
        "states": [{"name": "Off"}, {"name": "On"}],
        "transitions": [{"from_state": "Off", "to_state": "On", "event": "flip"}]
    }

    with patch("app.routers.parse.parse_natural_language", return_value=mock_result) as mock_nlp:
        # First call: Cache miss
        response1 = client.post("/api/parse/", json={"text": input_text}, cookies=cookies)
        assert response1.status_code == 200
        assert response1.json()["name"] == "Lamp"
        assert mock_nlp.call_count == 1
        
        # Second call: Cache hit
        response2 = client.post("/api/parse/", json={"text": input_text}, cookies=cookies)
        assert response2.status_code == 200
        assert response2.json()["name"] == "Lamp"
        # call_count should still be 1
        assert mock_nlp.call_count == 1

def test_parse_cache_miss_different_input():
    client = TestClient(app)
    cookies = get_auth_cookie()
    
    with patch("app.routers.parse.parse_natural_language") as mock_nlp:
        mock_nlp.side_effect = lambda text: {
            "name": text,
            "initial_state": "S",
            "states": [{"name": "S"}],
            "transitions": []
        }
        
        # Call 1
        client.post("/api/parse/", json={"text": "input 1"}, cookies=cookies)
        assert mock_nlp.call_count == 1
        
        # Call 2 with different input
        client.post("/api/parse/", json={"text": "input 2"}, cookies=cookies)
        assert mock_nlp.call_count == 2

def test_parse_cache_normalization():
    client = TestClient(app)
    cookies = get_auth_cookie()
    
    input_text = "  spaced input  "
    normalized_text = "spaced input"
    mock_result = {
        "name": "Test",
        "initial_state": "S",
        "states": [{"name": "S"}],
        "transitions": []
    }

    with patch("app.routers.parse.parse_natural_language", return_value=mock_result) as mock_nlp:
        # First call with spaces
        client.post("/api/parse/", json={"text": input_text}, cookies=cookies)
        assert mock_nlp.call_count == 1
        
        # Second call without spaces (should hit cache)
        client.post("/api/parse/", json={"text": normalized_text}, cookies=cookies)
        assert mock_nlp.call_count == 1

def test_parse_cache_not_used_on_error():
    client = TestClient(app)
    cookies = get_auth_cookie()
    
    input_text = "error input"
    
    with patch("app.routers.parse.parse_natural_language") as mock_nlp:
        mock_nlp.side_effect = ValueError("NLP failed")
        
        # First call: Error, should not cache
        response1 = client.post("/api/parse/", json={"text": input_text}, cookies=cookies)
        assert response1.status_code == 422
        assert mock_nlp.call_count == 1
        
        # Second call: Should try again (cache miss)
        response2 = client.post("/api/parse/", json={"text": input_text}, cookies=cookies)
        assert response2.status_code == 422
        assert mock_nlp.call_count == 2
