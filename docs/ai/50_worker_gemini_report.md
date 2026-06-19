# Worker Report

## Summary
SOT-846: スマホ(狭い画面)表示時に状態遷移図を上から下(縦方向)に描画するレイアウトを追加。
PC(広い画面)では従来の左→右(横方向)を維持。サンプルモデルも同じ DetailPage→StateDiagram
経由のため同一変更でカバー。

**Worker non-response disclosure:** 実装担当の Gemini CLI が IneligibleTierError (free tier 非対応,
`run_gemini.sh` exit 75) で応答不可、検証担当の Codex CLI も usage-limit cooldown (exit 75) で
応答不可。Worker Non-Response Fallback Policy に基づき Claude Code が実装・検証を代行。

## Changed Files
- `frontend/src/hooks/useMediaQuery.ts` — 新規。CSS media query を購読し viewport 変化に追従する小フック
- `frontend/src/components/StateDiagram.tsx` — orientation(縦/横)対応。`(max-width: 767px)` で縦方向に切替。
  ノード配置・エッジ経路(getEdgePath)・イベントラベル位置を orientation で分岐。COL_GAP/ROW_GAP を
  LAYER_GAP/SIBLING_GAP に一般化。

## Commands Run
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm run build` → success (既存の chunk>500kB 警告のみ、エラーなし)
- `npm test` / `npm run e2e` → スクリプト未定義のため N/A

## Acceptance Criteria
- [x] スマホ幅で状態遷移図が上→下に縦方向で描画される (BFS深さ→y軸, layer内→x軸)
- [x] PC幅では従来どおり左→右の横方向を維持
- [x] サンプルモデルでも同様に表示される（同コンポーネント経由）
- [x] lint / typecheck / build すべて pass

## Risks
- フロントにユニット/e2eテストが無く、縦レイアウトのエッジ描画の視覚的正しさは自動検証不可(差分レビュー依存)。
- 後退/同一layer遷移の縦配線は上側に回す簡易ルーティングのため、複雑なグラフで線が重なる可能性。

## Next Action
READY_FOR_REVIEW
