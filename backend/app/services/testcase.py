"""Deterministic test-case generation (SOT-1086 / SOT-1097).

From a generated state machine, derive representative test cases in four categories:
  - 正常系   (normal):   initial -> terminal happy paths
  - 異常系   (abnormal): an event applied where it is not defined (rejected transition)
  - キャンセル系 (cancel): a path that exercises a cancel-style event (or a gap notice)
  - タイムアウト系 (timeout): a path that exercises a timeout-style event (or a gap notice)

Generation is purely deterministic so it works with no AI configured.
"""
from __future__ import annotations

from typing import List, Optional

from ..schemas import TestCase, TestCaseRequest, TestCaseResponse, TestCaseStep

_CANCEL_KEYWORDS = ("cancel", "abort", "キャンセル", "取消", "取り消", "中止")
_TIMEOUT_KEYWORDS = ("timeout", "time_out", "timed_out", "expire", "タイムアウト", "時間切れ", "期限切れ")

# Cap normal-path enumeration so large machines do not produce an unwieldy list.
_MAX_NORMAL_CASES = 3


def _valid_transitions(state_names, transitions):
    return [
        t for t in transitions
        if (t.event or "").strip() and t.from_state in state_names and t.to_state in state_names
    ]


def _shortest_path(initial: str, target: str, transitions) -> Optional[List]:
    """BFS shortest path of transitions from `initial` to `target`. Returns the list
    of transitions, or None if unreachable. Empty list when initial == target."""
    if initial == target:
        return []
    adjacency = {}
    for t in transitions:
        adjacency.setdefault(t.from_state, []).append(t)
    visited = {initial}
    queue = [(initial, [])]
    while queue:
        cur, path = queue.pop(0)
        for t in adjacency.get(cur, []):
            if t.to_state in visited:
                continue
            new_path = path + [t]
            if t.to_state == target:
                return new_path
            visited.add(t.to_state)
            queue.append((t.to_state, new_path))
    return None


def _steps(path) -> List[TestCaseStep]:
    return [TestCaseStep(from_state=t.from_state, event=t.event, to_state=t.to_state) for t in path]


def _path_to_first(initial: str, targets, transitions):
    """Shortest path from initial to the nearest of `targets`. Returns (target, path) or (None, None)."""
    best = None
    best_target = None
    for tgt in targets:
        p = _shortest_path(initial, tgt, transitions)
        if p is not None and (best is None or len(p) < len(best)):
            best = p
            best_target = tgt
    return best_target, best


def generate_test_cases(initial_state: str, states, transitions) -> List[TestCase]:
    cases: List[TestCase] = []
    state_names = {s.name for s in states}
    valid = _valid_transitions(state_names, transitions)

    terminal_states = [s.name for s in states if s.is_terminal]
    has_outgoing = {t.from_state for t in valid}
    # Treat states with no outgoing transition as terminal too (sink states).
    sink_states = [s.name for s in states if s.name not in has_outgoing]
    end_states = list(dict.fromkeys(terminal_states + sink_states))

    # --- 正常系: shortest paths from initial to each end state ---
    normal_count = 0
    for end in end_states:
        path = _shortest_path(initial_state, end, valid)
        if path is None or not path:
            continue
        cases.append(TestCase(
            category="normal",
            title=f"正常系: {initial_state} → {end}",
            steps=_steps(path),
            expected=f"{initial_state} から開始し、各イベントを順に適用すると終了状態 '{end}' に到達する。",
        ))
        normal_count += 1
        if normal_count >= _MAX_NORMAL_CASES:
            break
    if normal_count == 0:
        cases.append(TestCase(
            category="normal",
            title="正常系: 終了状態に到達する経路なし",
            steps=[],
            expected="開始状態から到達できる終了状態が無いため、正常完了の経路を定義する必要があります。",
        ))

    # --- 異常系: an event applied in a state where it is not defined ---
    all_events = list(dict.fromkeys(t.event for t in valid))
    defined_from_initial = {t.event for t in valid if t.from_state == initial_state}
    abnormal_event = next((e for e in all_events if e not in defined_from_initial), None)
    if abnormal_event is None:
        abnormal_event = "invalid_event"
    cases.append(TestCase(
        category="abnormal",
        title=f"異常系: 状態 '{initial_state}' で未定義イベント '{abnormal_event}'",
        steps=[TestCaseStep(from_state=initial_state, event=abnormal_event, to_state="(no transition)")],
        expected=f"状態 '{initial_state}' ではイベント '{abnormal_event}' に対する遷移が定義されていないため、遷移は発生せず拒否される（状態は変化しない）。",
    ))

    # --- キャンセル系 / タイムアウト系 ---
    cases.append(_coverage_case("cancel", "キャンセル系", _CANCEL_KEYWORDS, initial_state, valid))
    cases.append(_coverage_case("timeout", "タイムアウト系", _TIMEOUT_KEYWORDS, initial_state, valid))

    return cases


def _coverage_case(category: str, label: str, keywords, initial_state: str, valid) -> TestCase:
    """Build a cancel/timeout test case: a path that exercises a matching event,
    or a gap-notice case when no such event exists."""
    matching = [t for t in valid if any(k.lower() in (t.event or "").lower() for k in keywords)]
    if not matching:
        return TestCase(
            category=category,
            title=f"{label}: 未定義",
            steps=[],
            expected=f"{label}に相当するイベントが定義されていません。{label}発生時の遷移先を仕様に追加してください。",
        )
    # Reach the nearest state from which a matching event fires, then apply it.
    sources = list(dict.fromkeys(t.from_state for t in matching))
    src, prefix = _path_to_first(initial_state, sources, valid)
    target = next(t for t in matching if t.from_state == src)
    steps = _steps(prefix or []) + [TestCaseStep(from_state=target.from_state, event=target.event, to_state=target.to_state)]
    return TestCase(
        category=category,
        title=f"{label}: {target.from_state} --[{target.event}]--> {target.to_state}",
        steps=steps,
        expected=f"状態 '{target.from_state}' でイベント '{target.event}' を適用すると '{target.to_state}' に遷移する。",
    )


def generate_test_cases_for_request(req: TestCaseRequest) -> TestCaseResponse:
    return TestCaseResponse(cases=generate_test_cases(req.initial_state, req.states, req.transitions))
