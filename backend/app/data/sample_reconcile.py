"""Shared helpers for reconciling sample state machines into a store.

Both the in-memory repository (local/test) and the Firestore seed (production)
need to (a) build fresh state/transition docs from a sample definition and
(b) decide whether an already-seeded sample doc differs from the current source
definition. Keeping the diff logic in one place means the two seed paths stay
consistent — e.g. a sample that gained `parent` grouping is refreshed in both.
"""
import uuid
from typing import List


def build_state_dicts(sample: dict) -> List[dict]:
    """Build Firestore-doc-shaped state dicts (fresh ids) from a sample."""
    return [
        {
            "id": str(uuid.uuid4()),
            "name": s["name"],
            "description": s.get("description", ""),
            "is_terminal": s.get("is_terminal", False),
            "parent": s.get("parent"),
        }
        for s in sample["states"]
    ]


def build_transition_dicts(sample: dict) -> List[dict]:
    """Build Firestore-doc-shaped transition dicts (fresh ids) from a sample."""
    return [
        {
            "id": str(uuid.uuid4()),
            "from_state": t["from_state"],
            "to_state": t["to_state"],
            "event": t["event"],
        }
        for t in sample["transitions"]
    ]


def _state_signature(state: dict):
    return (
        state.get("name"),
        state.get("is_terminal", False),
        state.get("parent"),
        state.get("description", ""),
    )


def _transition_signature(transition: dict):
    return (
        transition.get("from_state"),
        transition.get("to_state"),
        transition.get("event"),
    )


def sample_differs(stored: dict, sample: dict) -> bool:
    """Return True when a stored sample doc differs from the source definition.

    Compares initial_state, description, and the ordered states/transitions
    (by their meaningful fields, ignoring generated ids). Used so the seed
    reconcile refreshes an existing sample doc only when its content actually
    changed — e.g. when `parent` grouping was added after the doc was first
    seeded — and stays idempotent otherwise.
    """
    if stored.get("initial_state") != sample.get("initial_state"):
        return True
    if stored.get("description", "") != sample.get("description", ""):
        return True

    stored_states = [_state_signature(s) for s in stored.get("states", [])]
    source_states = [_state_signature(s) for s in sample.get("states", [])]
    if stored_states != source_states:
        return True

    stored_transitions = [_transition_signature(t) for t in stored.get("transitions", [])]
    source_transitions = [_transition_signature(t) for t in sample.get("transitions", [])]
    if stored_transitions != source_transitions:
        return True

    return False
