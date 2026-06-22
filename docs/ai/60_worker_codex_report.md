# Worker Report

## Summary
SOT-1015 is actionable now. The latest human comment on 2026-06-22 says: 「案1を中心に据え、案4,5の刷新点を取り入れる。」 This means implementation should proceed around FlowReview: replace state-machine terminology with business-flow terminology, redesign detail analysis as inspection results, add review comments, and incorporate JourneyStudio conversion/funnel dashboard ideas plus Ops Playbook template gallery/export/procedure-view ideas.

## Repo Findings
- terminology strings: `frontend/src/i18n/messages.ts` centralizes most Japanese/English UI labels for 状態/遷移, State/Transition, diagram, simulation, analysis, list, input, detail, and dashboard. Additional hard-coded UI strings exist in `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/StateDiagramEditor.tsx`, `frontend/src/components/stateEditorModel.ts`, and `frontend/src/components/StateDiagramEditor.test.tsx`. README also uses state-machine terminology heavily in `README.md`.
- analysis/validation panel: frontend panel is `frontend/src/components/AnalysisPanel.tsx`, mounted from `frontend/src/pages/DetailPage.tsx`. Backend analysis logic is `backend/app/services/analyzer.py`, exposed by `backend/app/routers/models.py` at `GET /models/{id}/analysis`, with response shape in `backend/app/schemas.py`. Save-time validation is `backend/app/services/validation.py`.
- StateDiagram: read-only diagram is `frontend/src/components/StateDiagram.tsx`; editable diagram is `frontend/src/components/StateDiagramEditor.tsx` with model helpers in `frontend/src/components/stateEditorModel.ts`. Relevant tests: `frontend/src/components/StateDiagram.test.tsx`, `frontend/src/components/StateDiagramEditor.test.tsx`, `frontend/src/components/stateEditorModel.test.ts`.
- list page: `frontend/src/pages/ListPage.tsx` already has `mine`/`sample` tabs and card grid. Samples are fetched via `getModels(view === 'sample')` from `frontend/src/api/index.ts`; backend route is `backend/app/routers/models.py`; seed/sample data is in `backend/app/data/sample_state_machines.py` with Ops candidates `ロボット保守ワークフロー`, `半導体製造装置`, and Journey candidate `SaaS営業フロー`.
- dashboard page: `frontend/src/pages/DashboardPage.tsx` already uses Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `CartesianGrid`) and is the candidate surface for funnel/conversion charts.
- export + data model: JSON export is client-side only in `frontend/src/pages/DetailPage.tsx` (`handleExport` builds a Blob and downloads JSON). There is no implemented PlantUML/PDF export found; `README.md` lists JSON/PlantUML export as future work. Frontend data model is `frontend/src/types/index.ts`; backend schema is `backend/app/schemas.py`; persistence/repository contracts are under `backend/app/repositories/`; sample data model instances are in `backend/app/data/sample_state_machines.py`.

## Commands Run
- `pwd && rg --files`
- Linear `get_issue` for `SOT-1015`
- Linear `list_comments` for `SOT-1015`
- `rg -n "状態|遷移|State|Transition|state|transition" frontend/src backend/app README.md`
- `sed -n '1,220p' frontend/package.json`
- `sed -n '1,260p' backend/pyproject.toml`
- `sed -n '1,260p' backend/pytest.ini`
- `sed -n '1,280p' frontend/src/pages/DetailPage.tsx`
- `sed -n '1,260p' frontend/src/components/AnalysisPanel.tsx`
- `sed -n '1,320p' frontend/src/components/StateDiagram.tsx`
- `sed -n '1,280p' frontend/src/pages/ListPage.tsx`
- `sed -n '1,320p' frontend/src/pages/DashboardPage.tsx`
- `sed -n '1,260p' frontend/src/types/index.ts`
- `sed -n '1,260p' backend/app/schemas.py`
- `sed -n '1,320p' backend/app/routers/models.py`
- `sed -n '1,220p' backend/app/services/analyzer.py`
- `sed -n '1,220p' backend/app/services/validation.py`
- `sed -n '1,260p' frontend/src/api/index.ts`
- `rg -n "export|JSON|PlantUML|PDF|pdf|plantuml|download|Blob|json" frontend/src backend/app README.md`
- `rg --files -g 'package.json' -g 'pnpm-lock.yaml' -g 'yarn.lock' -g 'package-lock.json'`
- `rg -n "状態|遷移|State Machine|State diagram|States|Transitions|state-transition|state machine|initial state|terminal state" frontend/src/App.tsx frontend/src/pages frontend/src/components frontend/src/i18n frontend/src/types/index.ts`
- `sed -n '1,220p' frontend/src/pages/InputPage.tsx`
- `sed -n '1,320p' frontend/src/i18n/messages.ts`
- `sed -n '1,260p' backend/app/data/sample_state_machines.py`

## Available Quality Gate
- lint: `cd frontend && npm run lint`
- typecheck: `cd frontend && npm run typecheck`
- test: `cd frontend && npm run test`
- build: `cd frontend && npm run build`

Note: there is no root `package.json`; the only package scripts are in `frontend/package.json`. Backend has `backend/pytest.ini`, `backend/pyproject.toml` with Ruff settings, and `backend/tests/`, but those are not package.json scripts.

## Acceptance Criteria
- [x] issue actionable
- [x] assets located

## Risks
- Terminology replacement is broad: most strings are centralized in i18n, but `StateDiagramEditor.tsx`, tests, `stateEditorModel.ts`, `App.tsx`, `LoginPage.tsx`, README, and backend/API schema names still expose state-machine vocabulary. Decide whether this issue is UI-only or includes API/schema rename; schema rename would be high blast radius.
- Conversion rate on states is not currently modeled. Adding it requires schema/type/repository/sample/editor/input changes, plus migration/default handling for existing stored models.
- Funnel/conversion dashboard can probably reuse Recharts, but meaningful conversion data is absent. Implementation needs a derived heuristic or persisted rate fields.
- Review comments are not present. Persisted comments need new schema/repository/API/storage decisions; a UI-only local comment feature would be lower risk but may not satisfy business review expectations.
- Export expansion has only JSON today. PlantUML is straightforward from the model graph; PDF likely needs a new browser library or backend renderer and should be split.
- Procedure view can derive numbered steps from transitions, but branching/loops in state machines make a single linear SOP ambiguous. Needs defined ordering and branch representation.
- Template gallery can reuse sample list data, but real gallery metadata/categories/tags do not exist yet.
- Existing dashboard uses dynamic Tailwind class strings like `bg-${color}-50`; verify generated CSS after redesign, because Tailwind may not include dynamic classes unless safelisted or replaced with static class maps.

## Next Action
READY_FOR_REVIEW
