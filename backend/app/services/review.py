"""Design-review service (SOT-1086 / SOT-1096).

Turns a generated state machine (+ optional original spec text) into a list of
design-review findings, each carrying a reason and a concrete repair suggestion.

The deterministic checks always run and cover the seven requested problem types:
  - 到達できない状態        -> unreachable_state
  - 未定義のイベント        -> undefined_event
  - 終了できない状態        -> non_terminating
  - 異常系の不足            -> missing_error_handling
  - キャンセル時の扱い不足  -> missing_cancel
  - タイムアウト時の扱い不足 -> missing_timeout
  - 条件のあいまいさ        -> ambiguous_condition

When AI (Gemini/Vertex) is configured AND the original spec text is provided, an
optional best-effort augmentation adds richer ambiguity/coverage findings. The
deterministic path is the source of truth and works with no AI configured.
"""
from __future__ import annotations

import json
import logging
from typing import List

from ..schemas import ReviewFinding, ReviewRequest, ReviewResponse
from .ai_client import gemini_available, get_genai_client, get_model_name

logger = logging.getLogger(__name__)

# Keyword sets used to detect whether the spec covers cancel / timeout / error paths.
# Matched case-insensitively as substrings against event and state names.
_CANCEL_KEYWORDS = ("cancel", "abort", "キャンセル", "取消", "取り消", "中止")
_TIMEOUT_KEYWORDS = ("timeout", "time_out", "timed_out", "expire", "タイムアウト", "時間切れ", "期限切れ")
_ERROR_KEYWORDS = ("error", "fail", "invalid", "reject", "異常", "失敗", "エラー", "却下", "拒否")


def _names_blob(states, transitions) -> str:
    """Lower-cased concatenation of every state name, description and event,
    used for keyword coverage checks."""
    parts: List[str] = []
    for s in states:
        parts.append(s.name or "")
        parts.append(getattr(s, "description", "") or "")
    for t in transitions:
        parts.append(t.event or "")
    return " ".join(parts).lower()


def _has_keyword(blob: str, keywords) -> bool:
    return any(k.lower() in blob for k in keywords)


def deterministic_review(initial_state: str, states, transitions) -> List[ReviewFinding]:
    """Run the deterministic graph + coverage checks. Pure, no AI."""
    findings: List[ReviewFinding] = []
    state_names = {s.name for s in states}

    # --- undefined_event: transitions referencing unknown states or with blank events ---
    valid_transitions = []
    for t in transitions:
        problems = []
        if not (t.event or "").strip():
            problems.append("イベント名が空です")
        if t.from_state not in state_names:
            problems.append(f"開始状態 '{t.from_state}' が未定義です")
        if t.to_state not in state_names:
            problems.append(f"遷移先状態 '{t.to_state}' が未定義です")
        if problems:
            findings.append(ReviewFinding(
                type="undefined_event",
                severity="error",
                target=f"{t.from_state} --[{t.event}]--> {t.to_state}",
                reason="；".join(problems),
                suggestion="未定義の状態を状態一覧に追加するか、遷移の参照先・イベント名を修正してください。",
            ))
        else:
            valid_transitions.append(t)

    # Adjacency over valid transitions (state-name graph).
    adjacency = {}
    for t in valid_transitions:
        adjacency.setdefault(t.from_state, []).append(t.to_state)

    # --- unreachable_state: not reachable from initial_state ---
    reachable = set()
    if initial_state in state_names:
        queue = [initial_state]
        reachable.add(initial_state)
        while queue:
            cur = queue.pop(0)
            for nxt in adjacency.get(cur, []):
                if nxt not in reachable:
                    reachable.add(nxt)
                    queue.append(nxt)
    else:
        findings.append(ReviewFinding(
            type="undefined_event",
            severity="error",
            target=initial_state,
            reason=f"開始状態 '{initial_state}' が状態一覧に存在しません。",
            suggestion="開始状態を状態一覧に追加するか、正しい状態名を開始状態に指定してください。",
        ))

    for s in states:
        if s.name not in reachable:
            findings.append(ReviewFinding(
                type="unreachable_state",
                severity="warning",
                target=s.name,
                reason=f"状態 '{s.name}' は開始状態 '{initial_state}' からどの遷移経路でも到達できません。",
                suggestion=f"'{s.name}' に到達する遷移を追加するか、不要であれば状態を削除してください。",
            ))

    # --- terminal states & non_terminating analysis ---
    has_outgoing = {t.from_state for t in valid_transitions}
    terminal_states = {s.name for s in states if s.is_terminal or s.name not in has_outgoing}

    if not any(s.is_terminal for s in states) and not any(
        s.name not in has_outgoing for s in states
    ):
        findings.append(ReviewFinding(
            type="non_terminating",
            severity="warning",
            target="",
            reason="終了状態（is_terminal もしくは出力遷移を持たない状態）が一つもありません。",
            suggestion="正常に処理が完了する終了状態を1つ以上定義してください。",
        ))

    # Reverse reachability: which states can reach some terminal state.
    reverse_adjacency = {}
    for t in valid_transitions:
        reverse_adjacency.setdefault(t.to_state, []).append(t.from_state)
    can_reach_terminal = set()
    queue = list(terminal_states)
    can_reach_terminal.update(terminal_states)
    while queue:
        cur = queue.pop(0)
        for prev in reverse_adjacency.get(cur, []):
            if prev not in can_reach_terminal:
                can_reach_terminal.add(prev)
                queue.append(prev)

    for s in states:
        # Only flag states that are actually reachable (otherwise unreachable already covers it).
        if s.name in reachable and s.name not in can_reach_terminal:
            if s.name not in has_outgoing and not s.is_terminal:
                reason = f"状態 '{s.name}' は出力遷移を持たず、終了状態にも指定されていません（デッドロック）。"
                suggestion = f"'{s.name}' を終了状態に指定するか、次に進む遷移を追加してください。"
            else:
                reason = f"状態 '{s.name}' からはどの経路をたどっても終了状態に到達できません。"
                suggestion = f"'{s.name}' から終了状態へ到達できる遷移経路を追加してください。"
            findings.append(ReviewFinding(
                type="non_terminating",
                severity="warning",
                target=s.name,
                reason=reason,
                suggestion=suggestion,
            ))

    # --- ambiguous_condition: duplicate (from_state, event) pairs ---
    pair_counts = {}
    for t in valid_transitions:
        key = (t.from_state, t.event)
        pair_counts[key] = pair_counts.get(key, 0) + 1
    seen_pairs = set()
    for t in valid_transitions:
        key = (t.from_state, t.event)
        if pair_counts[key] > 1 and key not in seen_pairs:
            seen_pairs.add(key)
            findings.append(ReviewFinding(
                type="ambiguous_condition",
                severity="warning",
                target=f"{t.from_state} --[{t.event}]-->",
                reason=f"状態 '{t.from_state}' で同じイベント '{t.event}' に対する遷移が複数定義されており、遷移先が一意に定まりません。",
                suggestion="ガード条件（分岐条件）を明示して遷移先を一意にするか、重複する遷移を統合してください。",
            ))

    # --- coverage checks: cancel / timeout / error handling ---
    blob = _names_blob(states, transitions)
    if not _has_keyword(blob, _CANCEL_KEYWORDS):
        findings.append(ReviewFinding(
            type="missing_cancel",
            severity="info",
            target="",
            reason="キャンセル／中止に相当するイベントや状態が見当たりません。ユーザー操作の取り消し経路が未定義の可能性があります。",
            suggestion="処理中の状態から取り消し（cancel）で戻る／終了する遷移を追加し、キャンセル時の振る舞いを定義してください。",
        ))
    if not _has_keyword(blob, _TIMEOUT_KEYWORDS):
        findings.append(ReviewFinding(
            type="missing_timeout",
            severity="info",
            target="",
            reason="タイムアウト／時間切れに相当するイベントや状態が見当たりません。待機状態での時間超過の扱いが未定義の可能性があります。",
            suggestion="待機・処理中の状態にタイムアウト（timeout）イベントを追加し、時間超過時の遷移先を定義してください。",
        ))
    if not _has_keyword(blob, _ERROR_KEYWORDS):
        findings.append(ReviewFinding(
            type="missing_error_handling",
            severity="info",
            target="",
            reason="エラー／失敗／異常系に相当するイベントや状態が見当たりません。異常時の経路が不足している可能性があります。",
            suggestion="処理失敗やバリデーションエラーなどの異常系イベントと、その遷移先（エラー状態など）を追加してください。",
        ))

    return findings


def _ai_review(spec_text: str, initial_state: str, states, transitions) -> List[ReviewFinding]:
    """Best-effort AI augmentation. Returns [] on any failure (never raises)."""
    try:
        client = get_genai_client()
        model_name = get_model_name()
        from google.genai import types as gtypes

        machine = {
            "initial_state": initial_state,
            "states": [{"name": s.name, "description": getattr(s, "description", "") or "", "is_terminal": s.is_terminal} for s in states],
            "transitions": [{"from_state": t.from_state, "to_state": t.to_state, "event": t.event} for t in transitions],
        }
        system_prompt = (
            "あなたは状態遷移仕様の設計レビューアです。与えられた自然言語仕様と、そこから生成された"
            "状態機械(JSON)を比較し、仕様の問題を指摘してください。特に次の観点に注目します:"
            " 異常系の不足(missing_error_handling)、キャンセル時の扱い不足(missing_cancel)、"
            "タイムアウト時の扱い不足(missing_timeout)、条件のあいまいさ(ambiguous_condition)。"
            "出力は JSON 配列のみ。各要素は"
            ' {"type": string, "severity": "error"|"warning"|"info", "target": string,'
            ' "reason": string(日本語), "suggestion": string(日本語)} の形。問題が無ければ [] を返す。'
        )
        prompt = (
            f"仕様:\n{spec_text}\n\n生成された状態機械(JSON):\n"
            f"{json.dumps(machine, ensure_ascii=False)}\n\n上記の観点で問題点を JSON 配列で返してください。"
        )
        config = gtypes.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
        )
        response = client.models.generate_content(model=model_name, contents=prompt, config=config)
        data = json.loads(response.text)
        if not isinstance(data, list):
            return []
        findings: List[ReviewFinding] = []
        allowed_types = {
            "missing_error_handling", "missing_cancel", "missing_timeout",
            "ambiguous_condition", "unreachable_state", "undefined_event", "non_terminating",
        }
        for item in data:
            if not isinstance(item, dict):
                continue
            ftype = item.get("type", "ambiguous_condition")
            if ftype not in allowed_types:
                ftype = "ambiguous_condition"
            severity = item.get("severity", "info")
            if severity not in ("error", "warning", "info"):
                severity = "info"
            reason = (item.get("reason") or "").strip()
            suggestion = (item.get("suggestion") or "").strip()
            if not reason:
                continue
            findings.append(ReviewFinding(
                type=ftype,
                severity=severity,
                target=(item.get("target") or "").strip(),
                reason=reason,
                suggestion=suggestion,
            ))
        return findings
    except Exception as e:  # noqa: BLE001 - augmentation must never break the response
        logger.warning(f"AI review augmentation failed, returning deterministic findings only: {e}")
        return []


def review_state_machine(req: ReviewRequest) -> ReviewResponse:
    """Combine deterministic checks with optional AI augmentation."""
    findings = deterministic_review(req.initial_state, req.states, req.transitions)
    ai_used = False

    if req.spec_text and req.spec_text.strip() and gemini_available():
        ai_findings = _ai_review(req.spec_text.strip(), req.initial_state, req.states, req.transitions)
        if ai_findings:
            ai_used = True
            # Deduplicate against deterministic findings by (type, target, reason) signature.
            seen = {(f.type, f.target, f.reason) for f in findings}
            for f in ai_findings:
                sig = (f.type, f.target, f.reason)
                if sig not in seen:
                    seen.add(sig)
                    findings.append(f)

    return ReviewResponse(findings=findings, ai_used=ai_used)
