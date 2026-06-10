from typing import Optional, List, Tuple

def simulate_step(current_state: str, event: str, transitions: List) -> Tuple[bool, Optional[str], str]:
    # Find matching transition: from_state == current_state AND event == event
    for t in transitions:
        if t.from_state == current_state and t.event == event:
            return (True, t.to_state, f"Transition executed: {current_state} --[{event}]--> {t.to_state}")
    
    # If not found
    return (False, None, f"No transition defined for state '{current_state}' with event '{event}'")
