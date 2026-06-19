import google.generativeai as genai
from google.api_core import exceptions as gexc
import os
import json
import logging
import random
import time

logger = logging.getLogger(__name__)

PARSE_MAX_RETRIES = int(os.getenv("PARSE_MAX_RETRIES", "3"))
PARSE_RETRY_BASE_DELAY = float(os.getenv("PARSE_RETRY_BASE_DELAY", "0.5"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

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

def _call_with_retry(model, prompt):
    """
    Call the Gemini API with exponential backoff retry.

    Maps google-api-core exceptions to the project's transport-error semantics:
    - ResourceExhausted (429) -> AIRateLimitError (after retries exhausted)
    - ServiceUnavailable / DeadlineExceeded / InternalServerError / any 5xx
      GoogleAPICallError -> AIServiceUnavailableError (after retries exhausted)
    - other 4xx GoogleAPICallError -> non-retryable RuntimeError("Gemini API error: ...")
    """
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            return model.generate_content(prompt)
        except gexc.ResourceExhausted as e:
            if attempt == PARSE_MAX_RETRIES:
                logger.error(f"AI API retry exhausted after {attempt} retries: {e}")
                raise AIRateLimitError(
                    f"AI解析のリクエスト制限に達しました。しばらく待ってから再試行してください。({str(e)})"
                )
            delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
            logger.warning(f"AI API rate limit (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s...")
            time.sleep(delay)

        except (gexc.ServiceUnavailable, gexc.DeadlineExceeded, gexc.InternalServerError) as e:
            # 5xx-equivalent transport errors
            if attempt == PARSE_MAX_RETRIES:
                logger.error(f"AI API retry exhausted (5xx) after {attempt} retries: {e}")
                raise AIServiceUnavailableError(
                    "AI解析サービスでサーバーエラーが発生しました。しばらく待ってから再試行してください。"
                )
            delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
            logger.warning(f"AI API 5xx error (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s...")
            time.sleep(delay)

        except gexc.GoogleAPICallError as e:
            # Generic Google API error: retry on 5xx, fail fast on 4xx.
            status_code = getattr(e, "code", None)
            code_value = getattr(status_code, "value", status_code)
            if isinstance(code_value, int) and code_value >= 500:
                if attempt == PARSE_MAX_RETRIES:
                    logger.error(f"AI API retry exhausted (5xx) after {attempt} retries: {code_value}")
                    raise AIServiceUnavailableError(
                        f"AI解析サービスでサーバーエラーが発生しました({code_value})。しばらく待ってから再試行してください。"
                    )
                delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
                logger.warning(f"AI API 5xx error (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {code_value}. Retrying in {delay:.2f}s...")
                time.sleep(delay)
            else:
                # 4xx errors (except ResourceExhausted) are not retried
                logger.error(f"Gemini API status error: {code_value} - {e}")
                raise RuntimeError(f"Gemini API error: {e}")

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
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise APIKeyNotConfiguredError(
            "GEMINI_API_KEY が設定されていません。AI解析機能を使用するには .env ファイルにAPIキーを設定してください。手動モードでステートマシンを作成することもできます。"
        )

    genai.configure(api_key=api_key)

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

    model = genai.GenerativeModel(
        GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config={"response_mime_type": "application/json"},
    )

    prompt = f"Extract the state machine from this description:\n\n{text}"

    # Retry loop covering "API call succeeded but response is unparseable / structurally
    # invalid". Transport-level errors are already retried inside _call_with_retry; here we
    # additionally retry parse failures with the same exponential backoff so a single bad
    # generation does not surface as a hard failure to the user.
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            response = _call_with_retry(model, prompt)

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
