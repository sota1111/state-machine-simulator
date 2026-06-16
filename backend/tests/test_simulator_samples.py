import pytest
from types import SimpleNamespace
from app.data.sample_state_machines import SAMPLE_STATE_MACHINES
from app.services.simulator import simulate_step

@pytest.mark.parametrize("sample", SAMPLE_STATE_MACHINES)
def test_simulator_with_samples(sample):
    name = sample["name"]
    transitions_data = sample["transitions"]
    # Convert dict transitions to objects with attribute access for simulator
    transitions = [SimpleNamespace(**t) for t in transitions_data]
    
    # Test a defined transition (representative path)
    # We take the first transition as a representative
    first_t = transitions_data[0]
    success, next_state, message = simulate_step(first_t["from_state"], first_t["event"], transitions)
    assert success is True
    assert next_state == first_t["to_state"]
    assert "Transition executed" in message

    # Test an undefined event from the initial state
    # We use a dummy event name that is unlikely to be in the sample
    dummy_event = "non_existent_event_123"
    success, next_state, message = simulate_step(sample["initial_state"], dummy_event, transitions)
    assert success is False
    assert next_state is None
    assert "No transition defined" in message

def test_simulator_representative_paths():
    # Specific test for a few representative paths
    
    # 1. Traffic Light: Red -> Green -> Yellow -> Red
    traffic_light = next(s for s in SAMPLE_STATE_MACHINES if "信号機" in s["name"])
    transitions = [SimpleNamespace(**t) for t in traffic_light["transitions"]]
    
    s1, n1, _ = simulate_step("Red", "timer_expire", transitions)
    assert n1 == "Green"
    s2, n2, _ = simulate_step("Green", "timer_expire", transitions)
    assert n2 == "Yellow"
    s3, n3, _ = simulate_step("Yellow", "timer_expire", transitions)
    assert n3 == "Red"

    # 2. Door: 閉 -> 開 -> 閉
    door = next(s for s in SAMPLE_STATE_MACHINES if "ドア" in s["name"])
    transitions = [SimpleNamespace(**t) for t in door["transitions"]]
    
    s1, n1, _ = simulate_step("閉", "開ける", transitions)
    assert n1 == "開"
    s2, n2, _ = simulate_step("開", "閉める", transitions)
    assert n2 == "閉"
