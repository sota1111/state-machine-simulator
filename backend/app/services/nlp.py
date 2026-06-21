import os
import json
import logging
import random
import time

from google.genai import errors as gerrors
from google.genai import types as gtypes

from .ai_client import gemini_available, get_genai_client, get_model_name

logger = logging.getLogger(__name__)

PARSE_MAX_RETRIES = int(os.getenv("PARSE_MAX_RETRIES", "3"))
PARSE_RETRY_BASE_DELAY = float(os.getenv("PARSE_RETRY_BASE_DELAY", "0.5"))

class APIKeyNotConfiguredError(Exception):
    pass

class AIRateLimitError(RuntimeError):
    pass

class AIServiceUnavailableError(RuntimeError):
    pass

class AIParseError(RuntimeError):
    """Raised when the AI response cannot be parsed into a valid state machine
    even after exhausting the parse retries."""
    pass

def _call_with_retry(generate):
    """
    Call the Vertex AI (google-genai) generation with exponential backoff retry.

    ``generate`` is a zero-arg callable returning the SDK response.

    Maps google-genai SDK errors to the project's transport-error semantics:
    - ClientError with code 429 (resource exhausted) -> AIRateLimitError (after retries)
    - ServerError (any 5xx) -> AIServiceUnavailableError (after retries)
    - other ClientError (4xx) -> non-retryable RuntimeError("Gemini API error: ...")
    """
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            return generate()
        except gerrors.ClientError as e:
            code = getattr(e, "code", None)
            if code == 429:
                # Rate limit (quota / resource exhausted)
                if attempt == PARSE_MAX_RETRIES:
                    logger.error(f"AI API retry exhausted after {attempt} retries: {e}")
                    raise AIRateLimitError(
                        f"AI解析のリクエスト制限に達しました。しばらく待ってから再試行してください。({str(e)})"
                    )
                delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
                logger.warning(f"AI API rate limit (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s...")
                time.sleep(delay)
            else:
                # Other 4xx errors are not retried
                logger.error(f"Gemini API status error: {code} - {e}")
                raise RuntimeError(f"Gemini API error: {e}")

        except gerrors.ServerError as e:
            # 5xx-equivalent transport errors
            if attempt == PARSE_MAX_RETRIES:
                logger.error(f"AI API retry exhausted (5xx) after {attempt} retries: {e}")
                raise AIServiceUnavailableError(
                    "AI解析サービスでサーバーエラーが発生しました。しばらく待ってから再試行してください。"
                )
            delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
            logger.warning(f"AI API 5xx error (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s...")
            time.sleep(delay)

def _parse_response(response) -> dict:
    """
    Parse and validate a single Gemini response into a state machine dict.
    Raises ValueError when the response is structurally invalid / unparseable.
    """
    try:
        text = response.text
    except Exception as e:
        raise ValueError(f"Gemini did not return any text content: {e}")

    if not text or not text.strip():
        raise ValueError("Gemini returned an empty response")

    # JSONDecodeError is a subclass of ValueError, so a malformed JSON body falls
    # through to the parse-retry path in parse_natural_language().
    result = json.loads(text)

    if not isinstance(result, dict):
        raise ValueError("Gemini did not return a state machine object")

    # Validate required fields
    required = ["name", "initial_state", "states", "transitions"]
    for field in required:
        if field not in result:
            raise ValueError(f"Missing required field: {field}")

    if not result.get("states"):
        raise ValueError("No states extracted from the description")

    # Ensure initial_state is in states (tolerant post-processing, not a failure)
    state_names = [s["name"] for s in result["states"]]
    if result["initial_state"] not in state_names:
        result["initial_state"] = state_names[0]
        logger.warning(f"initial_state not in states, defaulting to: {state_names[0]}")

    # Validate transitions reference valid states (tolerant post-processing)
    valid_transitions = []
    for t in result.get("transitions", []):
        if t.get("from_state") in state_names and t.get("to_state") in state_names:
            valid_transitions.append(t)
        else:
            logger.warning(f"Skipping invalid transition: {t}")
    result["transitions"] = valid_transitions

    return result


def parse_natural_language(text: str) -> dict:
    """
    Parse natural language description into a state machine JSON.
    Returns a dict matching StateMachineCreate schema.
    Raises ValueError on parse failure.
    Raises RuntimeError on API failure (or specialized AI errors).

    AI calls go through Vertex AI (google-genai) when GOOGLE_GENAI_USE_VERTEXAI is
    enabled (Cloud Run service-account ADC); otherwise an API-key client for local dev.
    """
    if not gemini_available():
        raise APIKeyNotConfiguredError(
            "AI解析機能が未設定です。本番では Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true)、"
            "ローカルでは GEMINI_API_KEY を設定してください。手動モードでステートマシンを作成することもできます。"
        )

    client = get_genai_client()
    model_name = get_model_name()

    system_prompt = """You are an expert at analyzing state machine specifications written in natural language.
Extract all states, events, and transitions. Follow these rules:
- State names should be descriptive (e.g., "Logged Out", "Payment Processing")
- Event names should be snake_case verbs (e.g., "submit_credentials", "timer_expire")
- Identify terminal states (states with no outgoing transitions)
- Identify the initial/starting state

Return ONLY a JSON object (no markdown, no prose) with exactly this shape:
{
  "name": string,                 // concise name for the state machine
  "description": string,          // brief description of what it models
  "initial_state": string,        // name of the starting state
  "states": [
    {"name": string, "description": string, "is_terminal": boolean}
  ],
  "transitions": [
    {"from_state": string, "to_state": string, "event": string}
  ]
}
Every transition's from_state and to_state must match a state name. Use snake_case for events."""

    config = gtypes.GenerateContentConfig(
        system_instruction=system_prompt,
        response_mime_type="application/json",
    )

    prompt = f"Extract the state machine from this description:\n\n{text}"

    def _generate():
        return client.models.generate_content(
            model=model_name, contents=prompt, config=config
        )

    # Retry loop covering "API call succeeded but response is unparseable / structurally
    # invalid". Transport-level errors are already retried inside _call_with_retry; here we
    # additionally retry parse failures with the same exponential backoff so a single bad
    # generation does not surface as a hard failure to the user.
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            response = _call_with_retry(_generate)

            result = _parse_response(response)
            logger.info("Successfully parsed state machine after potential retries")
            return result

        except (AIRateLimitError, AIServiceUnavailableError):
            # Re-raise specialized transport errors (already retried/exhausted upstream)
            raise
        except ValueError as e:
            # Unparseable / structurally invalid AI response — retry with backoff.
            if attempt == PARSE_MAX_RETRIES:
                logger.error(f"AI parse failed after {attempt} retries: {e}")
                raise AIParseError(
                    "AI解析結果を読み取れませんでした。お手数ですが入力内容を変えて再試行してください。"
                )
            delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
            logger.warning(
                f"AI parse failed (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s..."
            )
            time.sleep(delay)
