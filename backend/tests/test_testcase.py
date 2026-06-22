"""Tests for deterministic test-case generation (SOT-1097)."""
from app.schemas import StateCreate, TransitionCreate
from app.services.testcase import generate_test_cases


def _by_category(cases):
    out = {}
    for c in cases:
        out.setdefault(c.category, []).append(c)
    return out


def test_generates_all_four_categories_with_coverage():
    states = [
        StateCreate(name="Idle"),
        StateCreate(name="Waiting"),
        StateCreate(name="Cancelled", is_terminal=True),
        StateCreate(name="TimedOut", is_terminal=True),
        StateCreate(name="Done", is_terminal=True),
    ]
    transitions = [
        TransitionCreate(from_state="Idle", to_state="Waiting", event="start"),
        TransitionCreate(from_state="Waiting", to_state="Done", event="complete"),
        TransitionCreate(from_state="Waiting", to_state="Cancelled", event="cancel"),
        TransitionCreate(from_state="Waiting", to_state="TimedOut", event="timeout"),
    ]
    cases = generate_test_cases("Idle", states, transitions)
    by_cat = _by_category(cases)

    assert "normal" in by_cat and "abnormal" in by_cat
    assert "cancel" in by_cat and "timeout" in by_cat

    # Normal case reaches a terminal with steps.
    assert any(len(c.steps) > 0 for c in by_cat["normal"])

    # Cancel/timeout cases exercise their respective events.
    cancel = by_cat["cancel"][0]
    assert any(s.event == "cancel" for s in cancel.steps)
    timeout = by_cat["timeout"][0]
    assert any(s.event == "timeout" for s in timeout.steps)

    # Every case carries an expected result string.
    for c in cases:
        assert c.expected


def test_missing_cancel_and_timeout_produce_gap_notice():
    states = [StateCreate(name="A"), StateCreate(name="B", is_terminal=True)]
    transitions = [TransitionCreate(from_state="A", to_state="B", event="proceed")]
    cases = generate_test_cases("A", states, transitions)
    by_cat = _by_category(cases)

    # cancel/timeout still produced, but with no steps (gap notice) + expected text.
    assert by_cat["cancel"][0].steps == []
    assert by_cat["timeout"][0].steps == []
    assert "未定義" in by_cat["cancel"][0].title


def test_abnormal_case_uses_undefined_event():
    states = [StateCreate(name="A"), StateCreate(name="B", is_terminal=True)]
    transitions = [TransitionCreate(from_state="A", to_state="B", event="go")]
    cases = generate_test_cases("A", states, transitions)
    abnormal = _by_category(cases)["abnormal"][0]
    # The single step applies an event not defined from the initial state.
    assert abnormal.steps[0].from_state == "A"
    assert abnormal.steps[0].to_state == "(no transition)"
