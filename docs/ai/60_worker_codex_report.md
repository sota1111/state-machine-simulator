# Worker Report

## Summary
Added `backend/scripts/cleanup_removed_samples.py`, a guarded one-time Firestore cleanup script that targets only these exact document IDs and expected names:

- `303943d4-83b4-4f8f-ab52-c21481cf0a67` — `ai-dev-control-plane Issue実行パイプライン`
- `9f241261-7b47-47e3-a0d8-52a79cdaaff1` — `ai-dev-control-plane アプリ配備・認証状態`

Dry-run against production project `gen-lang-client-0243034020` reported both targets as `would-delete`. Real run hard-deleted both targets. Post-delete verification showed both target document IDs absent, `active_sample_count=8`, and `removed_names_active=[]`. A second real run exited 0 and reported both targets as `already-absent`.

## Changed Files
- `backend/scripts/cleanup_removed_samples.py` — guarded, idempotent cleanup script with exact ID/name target set, dry-run mode, guard checks, hard delete, and per-target summary.
- `docs/ai/60_worker_codex_report.md` — this worker report.

## Commands Run
- `python -m ruff check backend/scripts/cleanup_removed_samples.py` — passed.
- `printenv | rg '^(GCP_PROJECT_ID|GOOGLE_CLOUD_PROJECT|GOOGLE_APPLICATION_CREDENTIALS|APP_ENV)='` — confirmed `GCP_PROJECT_ID=gen-lang-client-0243034020`.
- `python backend/scripts/cleanup_removed_samples.py --dry-run` — exited 0; both target docs reported `would-delete`.
- `python backend/scripts/cleanup_removed_samples.py` — exited 0; both target docs reported `deleted`.
- `python - <<'PY' ...` Firestore verification — both exact target IDs returned `exists=False`; `active_sample_count=8`; `removed_names_active=[]`.
- `python backend/scripts/cleanup_removed_samples.py` — idempotency rerun exited 0; both target docs reported `already-absent`.
- `python -m ruff check .` in `backend/` — passed with the environment's existing Python.
- `python -m pytest` in `backend/` — initial run failed during collection because `google.genai` was not installed in the environment.
- `python3 -m venv /tmp/state-machine-simulator-venv` — created an isolated test environment.
- `/tmp/state-machine-simulator-venv/bin/python -m pip install -r requirements.txt -r requirements-test.txt` in `backend/` — installed declared backend dependencies.
- `/tmp/state-machine-simulator-venv/bin/python -m ruff check .` in `backend/` — passed.
- `/tmp/state-machine-simulator-venv/bin/python -m pytest` in `backend/` — passed: 64 passed, 28 warnings.

Key production cleanup output:

```text
DRY RUN: cleanup target collection=state_machines project=gen-lang-client-0243034020
Summary:
- 303943d4-83b4-4f8f-ab52-c21481cf0a67 (ai-dev-control-plane Issue実行パイプライン): would-delete
- 9f241261-7b47-47e3-a0d8-52a79cdaaff1 (ai-dev-control-plane アプリ配備・認証状態): would-delete
```

```text
REAL RUN: cleanup target collection=state_machines project=gen-lang-client-0243034020
Summary:
- 303943d4-83b4-4f8f-ab52-c21481cf0a67 (ai-dev-control-plane Issue実行パイプライン): deleted
- 9f241261-7b47-47e3-a0d8-52a79cdaaff1 (ai-dev-control-plane アプリ配備・認証状態): deleted
```

```text
target document existence:
- 303943d4-83b4-4f8f-ab52-c21481cf0a67 (ai-dev-control-plane Issue実行パイプライン): exists=False
- 9f241261-7b47-47e3-a0d8-52a79cdaaff1 (ai-dev-control-plane アプリ配備・認証状態): exists=False
active_sample_count=8
removed_names_active=[]
```

```text
REAL RUN: cleanup target collection=state_machines project=gen-lang-client-0243034020
Summary:
- 303943d4-83b4-4f8f-ab52-c21481cf0a67 (ai-dev-control-plane Issue実行パイプライン): already-absent
- 9f241261-7b47-47e3-a0d8-52a79cdaaff1 (ai-dev-control-plane アプリ配備・認証状態): already-absent
```

## Acceptance Criteria
- [x] Guarded idempotent cleanup script added
- [x] 2 target docs hard-deleted from prod Firestore (verified absent)
- [x] Idempotent re-run exits 0 with both already-absent
- [x] Backend lint + test pass

## Risks
- The cleanup is intentionally hard-coded to two production document IDs. It should not be generalized or reused for broad sample deletion.
- The first pytest attempt failed only because the base environment lacked declared dependencies; the full suite passed in an isolated venv after installing `requirements.txt` and `requirements-test.txt`.
- Firestore verification emitted non-failing warnings about positional `where(...)` filters in the ad hoc verification snippet; this did not affect cleanup or verification.

## Next Action
READY_FOR_REVIEW
