from types import SimpleNamespace
from app.services.simulator import simulate_step

def test_simulate_step_success():
    transitions = [
        SimpleNamespace(from_state="Red", to_state="Green", event="timer"),
        SimpleNamespace(from_state="Green", to_state="Yellow", event="timer")
    ]
    success, next_state, message = simulate_step("Red", "timer", transitions)
    assert success is True
    assert next_state == "Green"
    assert "Transition executed: Red --[timer]--> Green" in message

def test_simulate_step_no_transition():
    transitions = [
        SimpleNamespace(from_state="Red", to_state="Green", event="timer")
    ]
    success, next_state, message = simulate_step("Red", "not_timer", transitions)
    assert success is False
    assert next_state is None
    assert "No transition defined for state 'Red' with event 'not_timer'" in message

def test_simulate_step_different_state():
    transitions = [
        SimpleNamespace(from_state="Red", to_state="Green", event="timer")
    ]
    success, next_state, message = simulate_step("Green", "timer", transitions)
    assert success is False
    assert next_state is None
    assert "No transition defined for state 'Green' with event 'timer'" in message

def test_simulate_step_multiple_events_from_same_state():
    transitions = [
        SimpleNamespace(from_state="S1", to_state="S2", event="e1"),
        SimpleNamespace(from_state="S1", to_state="S3", event="e2")
    ]
    # Test e1
    s1, n1, _ = simulate_step("S1", "e1", transitions)
    assert s1 is True
    assert n1 == "S2"
    # Test e2
    s2, n2, _ = simulate_step("S1", "e2", transitions)
    assert s2 is True
    assert n2 == "S3"

def test_simulate_step_duplicate_transitions_picks_first():
    transitions = [
        SimpleNamespace(from_state="S1", to_state="S2", event="e1"),
        SimpleNamespace(from_state="S1", to_state="S3", event="e1")
    ]
    success, next_state, message = simulate_step("S1", "e1", transitions)
    assert success is True
    assert next_state == "S2" # First one in the list

def test_simulate_step_terminal_state():
    # End state with no outgoing transitions
    transitions = [
        SimpleNamespace(from_state="Start", to_state="End", event="finish")
    ]
    success, next_state, message = simulate_step("End", "any_event", transitions)
    assert success is False
    assert next_state is None

def test_simulate_step_empty_transitions():
    success, next_state, message = simulate_step("Any", "event", [])
    assert success is False
    assert next_state is None

def test_simulate_step_case_sensitivity():
    transitions = [
        SimpleNamespace(from_state="Red", to_state="Green", event="Timer")
    ]
    # Case mismatch in state
    s1, n1, _ = simulate_step("red", "Timer", transitions)
    assert s1 is False
    # Case mismatch in event
    s2, n2, _ = simulate_step("Red", "timer", transitions)
    assert s2 is False

def test_simulate_step_whitespace():
    transitions = [
        SimpleNamespace(from_state="Red", to_state="Green", event="timer")
    ]
    # Extra whitespace
    s1, n1, _ = simulate_step("Red ", "timer", transitions)
    assert s1 is False
    s2, n2, _ = simulate_step("Red", " timer", transitions)
    assert s2 is False
