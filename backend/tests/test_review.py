"""Tests for the deterministic design-review service (SOT-1096)."""
from app.schemas import StateCreate, TransitionCreate, ReviewRequest
from app.services.review import deterministic_review, review_state_machine


def _types(findings):
    return {f.type for f in findings}


def test_detects_unreachable_undefined_and_nonterminating():
    states = [
        StateCreate(name="Start"),
        StateCreate(name="Working"),
        StateCreate(name="Done", is_terminal=True),
        StateCreate(name="Orphan"),  # never referenced -> unreachable
        StateCreate(name="Stuck"),   # reachable, no outgoing, not terminal -> deadlock/non_terminating
    ]
    transitions = [
        TransitionCreate(from_state="Start", to_state="Working", event="begin"),
        TransitionCreate(from_state="Working", to_state="Done", event="finish"),
        TransitionCreate(from_state="Working", to_state="Stuck", event="error"),
        # undefined: references a state not in the list
        TransitionCreate(from_state="Working", to_state="Ghost", event="weird"),
    ]
    findings = deterministic_review("Start", states, transitions)
    found = _types(findings)

    assert "unreachable_state" in found
    assert any(f.target == "Orphan" for f in findings if f.type == "unreachable_state")
    assert "undefined_event" in found
    assert "non_terminating" in found
    assert any(f.target == "Stuck" for f in findings if f.type == "non_terminating")

    # Every finding carries a reason and a suggestion.
    for f in findings:
        assert f.reason
        assert f.suggestion
        assert f.severity in ("error", "warning", "info")


def test_detects_ambiguous_duplicate_transitions():
    states = [StateCreate(name="A"), StateCreate(name="B"), StateCreate(name="C", is_terminal=True)]
    transitions = [
        TransitionCreate(from_state="A", to_state="B", event="go"),
        TransitionCreate(from_state="A", to_state="C", event="go"),  # duplicate (A, go)
    ]
    findings = deterministic_review("A", states, transitions)
    ambiguous = [f for f in findings if f.type == "ambiguous_condition"]
    assert len(ambiguous) == 1
    assert ambiguous[0].target.startswith("A --[go]")


def test_flags_missing_cancel_timeout_error_when_absent():
    states = [StateCreate(name="A"), StateCreate(name="B", is_terminal=True)]
    transitions = [TransitionCreate(from_state="A", to_state="B", event="proceed")]
    found = _types(deterministic_review("A", states, transitions))
    assert "missing_cancel" in found
    assert "missing_timeout" in found
    assert "missing_error_handling" in found


def test_no_missing_flags_when_coverage_present():
    states = [
        StateCreate(name="Idle"),
        StateCreate(name="Waiting"),
        StateCreate(name="Cancelled", is_terminal=True),
        StateCreate(name="TimedOut", is_terminal=True),
        StateCreate(name="Failed", is_terminal=True),
        StateCreate(name="Done", is_terminal=True),
    ]
    transitions = [
        TransitionCreate(from_state="Idle", to_state="Waiting", event="start"),
        TransitionCreate(from_state="Waiting", to_state="Done", event="complete"),
        TransitionCreate(from_state="Waiting", to_state="Cancelled", event="cancel"),
        TransitionCreate(from_state="Waiting", to_state="TimedOut", event="timeout"),
        TransitionCreate(from_state="Waiting", to_state="Failed", event="error"),
    ]
    found = _types(deterministic_review("Idle", states, transitions))
    assert "missing_cancel" not in found
    assert "missing_timeout" not in found
    assert "missing_error_handling" not in found


def test_review_state_machine_falls_back_without_ai(monkeypatch):
    # Force AI unavailable so only deterministic findings are returned.
    monkeypatch.setattr("app.services.review.gemini_available", lambda: False)
    req = ReviewRequest(
        initial_state="A",
        states=[StateCreate(name="A"), StateCreate(name="B", is_terminal=True)],
        transitions=[TransitionCreate(from_state="A", to_state="B", event="go")],
        spec_text="A から B に進む",
    )
    resp = review_state_machine(req)
    assert resp.ai_used is False
    assert len(resp.findings) > 0
