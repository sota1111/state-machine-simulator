# Worker Report

## Summary
Repository state: branch is `main`; `git status --short` returned no entries, so the worktree was clean at inspection time.

Current app already supports natural-language-to-state-machine generation. Backend `/api/parse/` calls `parse_natural_language()` in `backend/app/services/nlp.py`, which prompts Gemini to return `name`, `description`, `initial_state`, `states`, and `transitions`. `/api/parse/refine` similarly calls `refine_state_machine()` to edit an existing generated flow. The current schema does not expose a separate event list; events exist only as the `event` field on each transition. The frontend `InputPage` can parse text, refine generated flows, preview a state diagram, show generated states/transitions behind a details toggle, run a frontend coverage check, and save the model.

Some structural problem detection exists, but it is not yet the requested design-review AI agent. Backend `analyzer.py` reports `unreachable_states`, `terminal_states`, `undefined_events`, counts, and simulation count. Its unreachable calculation is based on states with no incoming transition rather than full reachability from `initial_state`. Frontend `coverageAnalysis.ts` performs better graph-based checks for unreachable states, deadlock/non-terminal states with no outgoing transition, undefined transitions including unknown endpoints or blank events, and duplicate `(from_state, event)` ambiguity. `AnalysisPanel` and `CoveragePanel` display these findings, but they do not provide AI-generated reasons or concrete repair proposals. Existing detection does not cover abnormal-path insufficiency, cancel handling insufficiency, timeout handling insufficiency, or ambiguous conditions in the requested domain-review sense.

No automatic test-case generation feature was found. There is simulation support and developer tests for simulator behavior, but no backend service, API route, frontend type, API client, panel, or UI for generating normal, abnormal, cancel, or timeout test cases from a state machine.

Frontend `DetailPage` currently shows export actions, diagram/editor, `SimulationPanel`, backend `AnalysisPanel`, frontend `CoveragePanel`, localStorage-backed manual `ReviewComments`, states/transitions lists, and generated procedure steps. The manual review-comments panel is not AI-assisted.

Gap: SOT-1086 is actionable but large. It should likely be decomposed because it spans AI prompt/schema design, backend APIs, deterministic/AI-assisted review logic, frontend review UX, generated test-case data models, and tests.

Suggested child issue breakdown:
- Extend parse/review contract to include explicit event list and normalized generated artifacts while preserving existing parse/refine behavior.
- Add design-review analysis service/API that returns issue type, severity, evidence, reason, and suggested fix for unreachable/undefined/non-terminating/abnormal/cancel/timeout/ambiguous-condition findings.
- Implement deterministic graph checks server-side and decide which checks need AI/spec-text context.
- Add frontend design-review panel for findings with reasons and repair proposals on `InputPage` preview and `DetailPage`.
- Add test-case generation service/API for normal, abnormal, cancel, and timeout cases, including expected paths/events/results.
- Add frontend test-case panel/export UX and focused backend/frontend tests.

## Changed Files
- none (read-only task check)

## Commands Run
- `git branch --show-current && git status --short`
- `rg --files`
- `rg -n "parse|refine|coverage|unreachable|undefined|terminal|timeout|cancel|test case|testcase|テスト|到達不能|未定義|終了不能|キャンセル|タイムアウト|異常" .`
- `sed -n '1,340p' backend/app/services/nlp.py`
- `sed -n '1,180p' backend/app/routers/parse.py`
- `sed -n '1,180p' backend/app/services/analyzer.py`
- `sed -n '1,180p' backend/app/schemas.py`
- `sed -n '1,220p' frontend/src/utils/coverageAnalysis.ts`
- `sed -n '1,150p' frontend/src/components/CoveragePanel.tsx`
- `sed -n '1,140p' frontend/src/components/AnalysisPanel.tsx`
- `sed -n '1,520p' frontend/src/pages/InputPage.tsx`
- `sed -n '1,360p' frontend/src/pages/DetailPage.tsx`
- `sed -n '1,160p' frontend/src/api/index.ts`
- `sed -n '1,220p' frontend/src/types/index.ts`
- `sed -n '1,180p' frontend/src/components/ReviewComments.tsx`
- `rg -n "test case|testcase|generate.*test|正常系|異常系|キャンセル系|timeout|タイムアウト|review|修正案|reason|理由|suggest" backend frontend README.md docs`
- `sed -n '1,220p' backend/app/routers/models.py`
- `sed -n '1,220p' backend/app/services/validation.py`
- `sed -n '1,160p' frontend/src/utils/coverageAnalysis.test.ts`
- `sed -n '1,130p' backend/tests/test_parse_refine.py`
- `sed -n '1,140p' backend/tests/test_simulate_logic.py`
- `sed -n '1,240p' docs/ai/60_worker_codex_report.md`

## Acceptance Criteria
- [x] Issue is actionable (status/labels/blockers assessed)
- [x] Gap analysis: existing features vs requested features
- [x] Decomposition recommendation

## Risks
- AI provider availability/configuration is required for parse/refine today and would also affect any AI-assisted review/test generation unless deterministic fallbacks are added.
- Current parse response filters invalid transitions, which can hide some undefined-state problems before review unless raw AI output or validation findings are retained.
- Backend and frontend currently have overlapping but different analysis semantics; consolidating review logic will require a clear source of truth.
- Requirements mix graph-theoretic checks with specification-quality judgments; abnormal/cancel/timeout insufficiency and ambiguous conditions likely need original natural-language spec context, not only the saved state machine.
- Adding generated test cases may require new persistence/export decisions, not just transient UI.

## Next Action
READY_FOR_REVIEW
