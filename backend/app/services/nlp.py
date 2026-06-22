import os
import json
import logging
import random
import re
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

    # Derive an explicit, de-duplicated event list from the (validated) transitions,
    # preserving first-seen order. Events otherwise only exist as the `event` field on
    # each transition; this surfaces them as a standalone generated artifact (SOT-1095).
    seen_events: set = set()
    events: list = []
    for t in result["transitions"]:
        ev = (t.get("event") or "").strip()
        if ev and ev not in seen_events:
            seen_events.add(ev)
            events.append(ev)
    result["events"] = events

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


def refine_state_machine(current: dict, instruction: str) -> dict:
    """
    Apply a natural-language edit instruction to an existing state machine and
    return the full revised state machine JSON (same schema as parse_natural_language).

    ``current`` is a dict with name/description/initial_state/states/transitions.
    ``instruction`` is the user's natural-language modification request.

    Raises APIKeyNotConfiguredError when AI is unconfigured, the same transport
    errors as parsing (AIRateLimitError / AIServiceUnavailableError), and
    AIParseError when the AI response cannot be parsed after retries.
    """
    if not gemini_available():
        raise APIKeyNotConfiguredError(
            "AI解析機能が未設定です。本番では Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true)、"
            "ローカルでは GEMINI_API_KEY を設定してください。手動モードでステートマシンを作成することもできます。"
        )

    client = get_genai_client()
    model_name = get_model_name()

    system_prompt = """You are an expert at editing state machine specifications.
You are given an existing state machine as JSON and a natural-language instruction describing how to modify it.
Apply the instruction and return the COMPLETE revised state machine (not a diff). Follow these rules:
- Return the whole machine, keeping any parts the instruction does not mention.
- State names should be descriptive; event names should be snake_case verbs.
- Identify terminal states (states with no outgoing transitions) and the initial/starting state.

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

    current_json = json.dumps(current, ensure_ascii=False)
    prompt = (
        "Here is the current state machine as JSON:\n\n"
        f"{current_json}\n\n"
        "Apply this modification instruction and return the full revised state machine:\n\n"
        f"{instruction}"
    )

    def _generate():
        return client.models.generate_content(
            model=model_name, contents=prompt, config=config
        )

    # Same retry structure as parse_natural_language: transport errors are retried inside
    # _call_with_retry; unparseable / structurally invalid responses are retried here.
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            response = _call_with_retry(_generate)

            result = _parse_response(response)
            logger.info("Successfully refined state machine after potential retries")
            return result

        except (AIRateLimitError, AIServiceUnavailableError):
            raise
        except ValueError as e:
            if attempt == PARSE_MAX_RETRIES:
                logger.error(f"AI refine failed after {attempt} retries: {e}")
                raise AIParseError(
                    "AI解析結果を読み取れませんでした。お手数ですが修正指示を変えて再試行してください。"
                )
            delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
            logger.warning(
                f"AI refine failed (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s..."
            )
            time.sleep(delay)


# --- Flow import from code / procedure documents (SOT-1104, 2-E) -----------------

def _extract_transition_line(line: str):
    """Try to read a single (from_state, to_state, event) edge from one text line.

    Recognizes labeled arrows (``A --[event]--> B`` / ``A -- event --> B``) and plain
    arrows (``A -> B`` / ``A => B`` / ``A → B`` with an optional ``: event`` suffix).
    Returns None when the line is not an edge.
    """
    line = line.strip()
    if not line:
        return None

    # Labeled arrow: A --[event]--> B  or  A -- event --> B
    m = re.match(r'^(.+?)\s*--\s*\[?\s*(.+?)\s*\]?\s*--+>\s*(.+?)$', line)
    if m:
        frm, ev, to = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        return frm, to, (ev or "next")

    # Plain arrow: A -> B [: event] | A => B | A → B
    m = re.match(r'^(.+?)\s*(?:->|=>|→)\s*(.+?)$', line)
    if m:
        frm = m.group(1).strip()
        rest = m.group(2).strip()
        ev = "next"
        to = rest
        if ":" in rest:
            to_part, ev_part = rest.split(":", 1)
            to, ev = to_part.strip(), (ev_part.strip() or "next")
        return frm, to, ev

    return None


def _finalize_extracted(names, transitions, source_label: str) -> dict:
    if not names:
        raise ValueError("No states could be extracted from the input")
    outgoing = {tr["from_state"] for tr in transitions}
    states = [{"name": n, "description": "", "is_terminal": n not in outgoing} for n in names]
    events: list = []
    seen: set = set()
    for tr in transitions:
        ev = (tr.get("event") or "").strip()
        if ev and ev not in seen:
            seen.add(ev)
            events.append(ev)
    return {
        "name": source_label,
        "description": "",
        "initial_state": names[0],
        "states": states,
        "transitions": transitions,
        "events": events,
    }


def heuristic_extract(text: str) -> dict:
    """Deterministic, AI-free extraction of a state machine from code / procedure text.

    Strategy: first collect explicit arrow edges; if none are found, treat the input as
    an ordered list of steps (numbered / bulleted / plain lines) chained by a ``next``
    event. Used as the fallback when no AI client is configured, so the feature works
    (and is testable) without external dependencies.
    """
    lines = text.splitlines()

    transitions: list = []
    for line in lines:
        parsed = _extract_transition_line(line)
        if parsed:
            frm, to, ev = parsed
            transitions.append({"from_state": frm, "to_state": to, "event": ev})

    if transitions:
        names: list = []
        for tr in transitions:
            for n in (tr["from_state"], tr["to_state"]):
                if n not in names:
                    names.append(n)
        return _finalize_extracted(names, transitions, "Imported Flow")

    # Fallback: ordered steps chained with a generic "next" event.
    steps: list = []
    for line in lines:
        s = line.strip()
        if not s:
            continue
        s = re.sub(r'^\s*(?:\d+[\.\)]|[-*•])\s*', "", s).strip()
        if s and s not in steps:
            steps.append(s)

    transitions = [
        {"from_state": steps[i], "to_state": steps[i + 1], "event": "next"}
        for i in range(len(steps) - 1)
    ]
    return _finalize_extracted(steps, transitions, "Imported Flow")


def _ai_import(text: str, source_type: str) -> dict:
    """AI-backed extraction of a state machine from code / procedure text."""
    client = get_genai_client()
    model_name = get_model_name()

    kind = {
        "code": "source code",
        "procedure": "a procedure / operations document",
    }.get(source_type, "source code or a procedure document")

    system_prompt = (
        f"You extract a state machine from {kind}.\n"
        "Identify states, the single initial state, terminal states, and transitions with "
        "snake_case event names.\n"
        "Return ONLY a JSON object (no markdown, no prose) with exactly this shape:\n"
        '{"name": string, "description": string, "initial_state": string, '
        '"states": [{"name": string, "description": string, "is_terminal": boolean}], '
        '"transitions": [{"from_state": string, "to_state": string, "event": string}]}\n'
        "Every transition's from_state and to_state must match a state name."
    )

    config = gtypes.GenerateContentConfig(
        system_instruction=system_prompt,
        response_mime_type="application/json",
    )
    prompt = f"Extract the state machine from the following {kind}:\n\n{text}"

    def _generate():
        return client.models.generate_content(model=model_name, contents=prompt, config=config)

    # Transport errors are retried inside _call_with_retry; a structurally invalid
    # response surfaces as ValueError and the caller falls back to the heuristic.
    response = _call_with_retry(_generate)
    return _parse_response(response)


def import_flow(text: str, source_type: str = "auto") -> dict:
    """Extract a state machine from code / a procedure document.

    Uses the AI client when one is configured, and a deterministic heuristic otherwise
    (or whenever the AI response cannot be used), so the endpoint always returns a usable
    result without hard external dependencies.
    """
    if gemini_available():
        try:
            return _ai_import(text, source_type)
        except (AIRateLimitError, AIServiceUnavailableError, AIParseError, ValueError, RuntimeError) as e:
            logger.warning(f"AI import failed, falling back to heuristic: {e}")
            return heuristic_extract(text)
    return heuristic_extract(text)
