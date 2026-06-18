import anthropic
import os
import logging
import random
import time

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

def _call_with_retry(client, **kwargs):
    """
    Call Anthropic API with exponential backoff retry.
    """
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            return client.messages.create(**kwargs)
        except (anthropic.RateLimitError,
                anthropic.APIConnectionError,
                anthropic.APITimeoutError) as e:
            if attempt == PARSE_MAX_RETRIES:
                logger.error(f"AI API retry exhausted after {attempt} retries: {e}")
                if isinstance(e, anthropic.RateLimitError):
                    raise AIRateLimitError(
                        f"AI解析のリクエスト制限に達しました。しばらく待ってから再試行してください。({str(e)})"
                    )
                raise AIServiceUnavailableError(
                    f"AI解析サービスが一時的に利用できません。しばらく待ってから再試行してください。({str(e)})"
                )
            
            delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
            logger.warning(f"AI API error (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e}. Retrying in {delay:.2f}s...")
            time.sleep(delay)
            
        except anthropic.APIStatusError as e:
            # Retry on 5xx errors
            if e.status_code >= 500:
                if attempt == PARSE_MAX_RETRIES:
                    logger.error(f"AI API retry exhausted (5xx) after {attempt} retries: {e.status_code}")
                    raise AIServiceUnavailableError(
                        f"AI解析サービスでサーバーエラーが発生しました({e.status_code})。しばらく待ってから再試行してください。"
                    )
                
                delay = PARSE_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, PARSE_RETRY_BASE_DELAY)
                logger.warning(f"AI API 5xx error (attempt {attempt+1}/{PARSE_MAX_RETRIES+1}): {e.status_code}. Retrying in {delay:.2f}s...")
                time.sleep(delay)
            else:
                # 4xx errors (except RateLimitError) are not retried
                logger.error(f"Anthropic API status error: {e.status_code} - {e.message}")
                raise RuntimeError(f"Claude API error: {e.message}")

def _parse_response(response) -> dict:
    """
    Parse and validate a single Anthropic response into a state machine dict.
    Raises ValueError when the response is structurally invalid / unparseable.
    """
    # Find the tool use block
    tool_use_block = None
    for block in response.content:
        if block.type == "tool_use" and block.name == "create_state_machine":
            tool_use_block = block
            break

    if not tool_use_block:
        raise ValueError("Claude did not return a state machine structure")

    result = tool_use_block.input

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
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise APIKeyNotConfiguredError(
            "ANTHROPIC_API_KEY が設定されていません。AI解析機能を使用するには .env ファイルにAPIキーを設定してください。手動モードでステートマシンを作成することもできます。"
        )
    
    client = anthropic.Anthropic(api_key=api_key)
    
    tools = [
        {
            "name": "create_state_machine",
            "description": "Extract a state machine model from a natural language description. Identify all states, transitions between states, and events that trigger those transitions.",
            "input_schema": {
                "type": "object",
                "required": ["name", "description", "initial_state", "states", "transitions"],
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "A concise name for the state machine (e.g., 'Login Flow', 'Order Process')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief description of what this state machine models"
                    },
                    "initial_state": {
                        "type": "string",
                        "description": "The name of the starting state"
                    },
                    "states": {
                        "type": "array",
                        "description": "List of all states in the state machine",
                        "items": {
                            "type": "object",
                            "required": ["name"],
                            "properties": {
                                "name": {"type": "string", "description": "State name (unique within the model)"},
                                "description": {"type": "string", "description": "What this state represents"},
                                "is_terminal": {"type": "boolean", "description": "True if this is a final/end state with no outgoing transitions"}
                            }
                        }
                    },
                    "transitions": {
                        "type": "array",
                        "description": "List of all transitions between states",
                        "items": {
                            "type": "object",
                            "required": ["from_state", "to_state", "event"],
                            "properties": {
                                "from_state": {"type": "string", "description": "Name of the source state"},
                                "to_state": {"type": "string", "description": "Name of the target state"},
                                "event": {"type": "string", "description": "Event/trigger that causes this transition (snake_case)"}
                            }
                        }
                    }
                }
            }
        }
    ]
    
    system_prompt = """You are an expert at analyzing state machine specifications written in natural language.
Extract all states, events, and transitions. Follow these rules:
- State names should be descriptive (e.g., "Logged Out", "Payment Processing")
- Event names should be snake_case verbs (e.g., "submit_credentials", "timer_expire")
- Identify terminal states (states with no outgoing transitions)
- Identify the initial/starting state
- Use the create_state_machine tool to return the extracted model"""
    
    # Retry loop covering "API call succeeded but response is unparseable / structurally
    # invalid". Transport-level errors are already retried inside _call_with_retry; here we
    # additionally retry parse failures with the same exponential backoff so a single bad
    # generation does not surface as a hard failure to the user.
    for attempt in range(PARSE_MAX_RETRIES + 1):
        try:
            response = _call_with_retry(
                client,
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=system_prompt,
                tools=tools,
                tool_choice={"type": "any"},
                messages=[
                    {
                        "role": "user",
                        "content": f"Extract the state machine from this description:\n\n{text}"
                    }
                ]
            )

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
        except anthropic.APIConnectionError as e:
            logger.error(f"Anthropic API connection error: {e}")
            raise RuntimeError(f"Failed to connect to Claude API: {str(e)}")
        except anthropic.APIStatusError as e:
            logger.error(f"Anthropic API status error: {e.status_code} - {e.message}")
            raise RuntimeError(f"Claude API error: {e.message}")
