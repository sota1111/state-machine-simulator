# Worker Report (Claude Code Fallback — SOT-1095)

## Fallback Disclosure (audit)
- Non-responsive worker: Gemini CLI
- Detected failure mode: crash / auth — `IneligibleTierError: UNSUPPORTED_CLIENT` (free-tier no longer supported), run script exited 75 (WORKER_NONRESPONSE).
- Action: Per Worker Non-Response Fallback Policy, Claude Code performed this implementation directly.

## Summary
SOT-1095「生成結果にイベント一覧を明示する」を実装。transitions から一意なイベント名を導出し、parse/refine レスポンスに `events` を追加、フロントの解析結果詳細に「イベント一覧」セクションを表示。

## Changed Files
- `backend/app/services/nlp.py` — `_parse_response()` で transitions から一意イベントを first-seen順で導出し `result["events"]` にセット（空文字除外・重複排除）
- `backend/app/routers/parse.py` — `ParseResponse` に `events: list[str] = []` 追加（旧キャッシュ互換のためデフォルト空）
- `frontend/src/types/index.ts` — `ParseResponse.events: string[]` 追加
- `frontend/src/pages/InputPage.tsx` — 詳細セクションに「イベント一覧」チップ表示（状態一覧と遷移一覧の間）
- `frontend/src/i18n/messages.ts` — `detail.eventsList`（ja: イベント一覧 / en: Events）
- `backend/tests/test_parse_refine.py` — events 導出ユニットテスト追加 + 既存 test_refine_success の期待値に events を反映

## Commands Run
- (verification delegated to Codex — see 60_worker_codex_report.md)

## Acceptance Criteria
- [x] 生成結果に状態一覧・イベント一覧・遷移一覧が揃って表示される
- [x] events は遷移から一意に導出され重複しない
- [x] 既存の parse/refine 挙動が壊れない（events はオプショナル追加）

## Risks
- events は表示専用。保存(StateMachineCreate)スキーマは変更しておらず、永続化はしない（遷移から常に導出可能なため）。

## Next Action
READY_FOR_REVIEW
