import pytest
from app.data.sample_state_machines import SAMPLE_STATE_MACHINES

@pytest.mark.parametrize("sample", SAMPLE_STATE_MACHINES)
def test_sample_integrity(sample):
    name = sample["name"]
    states = sample["states"]
    transitions = sample["transitions"]
    initial_state = sample["initial_state"]

    # (a) State names are unique
    state_names = [s["name"] for s in states]
    assert len(state_names) == len(set(state_names)), f"Sample '{name}' has duplicate state names"

    # (b) initial_state is in states
    assert initial_state in state_names, f"Sample '{name}' initial_state '{initial_state}' not in states"

    # (c) All transition from_state/to_state are in states
    for t in transitions:
        assert t["from_state"] in state_names, f"Sample '{name}' transition from_state '{t['from_state']}' not in states"
        assert t["to_state"] in state_names, f"Sample '{name}' transition to_state '{t['to_state']}' not in states"

    # (d) At least one transition
    assert len(transitions) > 0, f"Sample '{name}' has no transitions"

    # (e) All states are reachable from initial_state
    reachable = {initial_state}
    stack = [initial_state]
    
    # Simple reachability using stack-based DFS
    while stack:
        current = stack.pop()
        for t in transitions:
            if t["from_state"] == current and t["to_state"] not in reachable:
                reachable.add(t["to_state"])
                stack.append(t["to_state"])
    
    unreachable = set(state_names) - reachable
    assert not unreachable, f"Sample '{name}' has unreachable states: {unreachable}"


@pytest.mark.parametrize("sample", SAMPLE_STATE_MACHINES)
def test_parent_state_grouping(sample):
    """Complex samples (state count > 5) must assign a parent (group) to every state;
    simple samples (<= 5) stay flat with no parent."""
    name = sample["name"]
    states = sample["states"]

    if len(states) > 5:
        missing = [s["name"] for s in states if not s.get("parent")]
        assert not missing, f"Complex sample '{name}' missing parent on states: {missing}"
    else:
        grouped = [s["name"] for s in states if s.get("parent")]
        assert not grouped, f"Simple sample '{name}' should be flat but has parent on: {grouped}"
