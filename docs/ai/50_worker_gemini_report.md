# Worker Report

## Fallback Disclosure
- Non-responsive worker: **Gemini CLI**
- Detected failure mode: `run_gemini.sh` exited **75** (WORKER_NONRESPONSE); root cause `IneligibleTierError: UNSUPPORTED_CLIENT` (Gemini Code Assist free tier no longer supported). Permanent condition — retry would not help.
- Action: Per the Worker Non-Response Fallback Policy, **Claude Code performed the implementation directly**.

## Summary
SOT-1076: 生成されたワークフローを自然言語で修正できるようにした。AIが説明文からステートマシン
（`parsed`）を生成した後、ユーザーが自然言語の修正指示を入力すると、AIがワークフロー全体を
再生成してプレビューを差し替える。

## Changed Files
- `backend/app/services/nlp.py` — `refine_state_machine(current, instruction)` 追加。`_call_with_retry`/`_parse_response`・既存例外クラスを再利用。
- `backend/app/routers/parse.py` — `RefineRequest` モデルと `POST /parse/refine` 追加（キャッシュなし）、`/parse/` と同一のエラーマッピング。
- `frontend/src/types/index.ts` — `RefineRequest` 追加。
- `frontend/src/api/index.ts` — `refineWorkflow(data)` 追加。
- `frontend/src/pages/InputPage.tsx` — AI解析結果パネルに修正指示 textarea + ボタン + `refineMutation` を追加。成功時 `parsed` を差し替え。
- `frontend/src/i18n/messages.ts` — `input.refineLabel/refinePlaceholder/refineBtn/refining`（ja+en）追加。

## Commands Run
- (verification delegated to Codex — see docs/ai/60_worker_codex_report.md)

## Acceptance Criteria
- [x] 生成済みワークフローを自然言語指示で修正できる
- [x] 初回生成と同じスキーマを返し、`_parse_response` で整合検証
- [x] `/parse/` と同じエラーハンドリング

## Risks
- AI 呼び出しは本番で Vertex/GEMINI 設定が必要（既存 parse と同条件）。検証では AI をモックしてライブ呼び出しを避けること。

## Next Action
NEEDS_DEBUG
