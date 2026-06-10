import anthropic
import os
import logging

logger = logging.getLogger(__name__)

def parse_natural_language(text: str) -> dict:
    """
    Parse natural language description into a state machine JSON.
    Returns a dict matching StateMachineCreate schema.
    Raises ValueError on parse failure.
    Raises RuntimeError on API failure.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
    
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
    
    try:
        response = client.messages.create(
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
        
        # Ensure initial_state is in states
        state_names = [s["name"] for s in result["states"]]
        if result["initial_state"] not in state_names:
            result["initial_state"] = state_names[0]
            logger.warning(f"initial_state not in states, defaulting to: {state_names[0]}")
        
        # Validate transitions reference valid states
        valid_transitions = []
        for t in result.get("transitions", []):
            if t.get("from_state") in state_names and t.get("to_state") in state_names:
                valid_transitions.append(t)
            else:
                logger.warning(f"Skipping invalid transition: {t}")
        result["transitions"] = valid_transitions
        
        return result
        
    except anthropic.APIConnectionError as e:
        logger.error(f"Anthropic API connection error: {e}")
        raise RuntimeError(f"Failed to connect to Claude API: {str(e)}")
    except anthropic.APIStatusError as e:
        logger.error(f"Anthropic API status error: {e.status_code} - {e.message}")
        raise RuntimeError(f"Claude API error: {e.message}")
