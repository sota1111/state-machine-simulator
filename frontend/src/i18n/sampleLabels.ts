import type { Lang } from './messages'

// Display-only JP→EN translations for the seeded sample state machines.
// Maps Japanese sample literals (machine names, state names, event names, parent/group names)
// to natural English. Used ONLY for rendering; the underlying values (API calls, store keys,
// comparisons, layout) must stay in the original language so the simulation keeps working.
// Strings that are already English (Cart, Red, JWT, Todo, Done, ...) are intentionally absent;
// the fallback returns them unchanged.
const sampleEn: Record<string, string> = {
  // --- Machine names ---
  'ログインフロー (Login Flow)': 'Login Flow',
  '注文フロー (Order Flow)': 'Order Flow',
  '信号機 (Traffic Light)': 'Traffic Light',
  'ドア (Door)': 'Door',
  '自動販売機 (Vending Machine)': 'Vending Machine',
  'ロボット保守ワークフロー (Robot Maintenance)': 'Robot Maintenance',
  '半導体製造装置 (Semiconductor Equipment)': 'Semiconductor Equipment',
  'SaaS営業フロー (SaaS Sales)': 'SaaS Sales',

  // --- Shared literals (used across multiple samples; keep a single mapping) ---
  '待機': 'Idle',
  '起動': 'Startup',
  '完了': 'Completed',
  'キャンセル': 'Cancel',

  // --- Order Flow (parents) ---
  '注文受付': 'Order Intake',
  '決済処理': 'Payment',
  '配送': 'Shipping',

  // --- Door ---
  '閉': 'Closed',
  '開': 'Open',
  '開ける': 'open',
  '閉める': 'close',

  // --- Vending Machine ---
  '選択': 'Selecting',
  '支払': 'Payment',
  '排出': 'Dispensing',
  '商品選択': 'select_item',
  'コイン投入': 'insert_coin',
  '確定': 'confirm',

  // --- Robot Maintenance ---
  '受付・分析': 'Intake & Analysis',
  '修理対応': 'Repair',
  '完了処理': 'Completion',
  '問い合わせ受付': 'Inquiry Received',
  '原因分析': 'Root Cause Analysis',
  'ベンダー対応': 'Vendor Handling',
  '自社保守対応': 'In-house Maintenance',
  '完了確認': 'Completion Check',
  '分析開始': 'start_analysis',
  'ベンダー依頼': 'request_vendor',
  '内部修理': 'internal_repair',
  '修理完了報告': 'repair_report',
  '修理完了': 'repair_done',
  '確認OK': 'check_ok',
  '再調査必要': 'recheck_needed',

  // --- Semiconductor Equipment ---
  '稼働': 'Operation',
  '異常': 'Fault',
  '電源投入': 'Power On',
  '初期化中': 'Initializing',
  'レシピ設定': 'Recipe Setup',
  '搬送中': 'Transferring',
  '処理中': 'Processing',
  'アラーム': 'Alarm',
  '非常停止': 'Emergency Stop',
  '初期化完了': 'init_complete',
  'レシピ選択': 'select_recipe',
  '開始': 'start',
  '搬送完了': 'transfer_complete',
  '処理完了': 'process_complete',
  'エラー発生': 'error_occurred',
  'プロセスエラー': 'process_error',
  '復旧': 'recover',
  '緊急停止ボタン': 'emergency_stop_button',
  '再起動': 'restart',

  // --- SaaS Sales ---
  'アプローチ': 'Approach',
  '商談': 'Negotiation',
  'クローズ': 'Close',
  'リード獲得': 'Lead Acquired',
  'コンタクト済み': 'Contacted',
  'ヒアリング中': 'Discovery',
  '提案中': 'Proposing',
  '承認待ち': 'Awaiting Approval',
  '見積提出': 'Quote Submitted',
  '受注': 'Won',
  '失注': 'Lost',
  'メール送信': 'send_email',
  '商談セット': 'set_meeting',
  'デモ実施': 'run_demo',
  '稟議申請': 'request_approval',
  '承認完了': 'approved',
  '成約': 'closed_won',
  '競合敗退': 'lost_to_competitor',
  '予算NG': 'budget_rejected',
  '再提案': 're_propose',
}

// Return the English label when lang==='en' and a mapping exists; otherwise return the original.
export function sampleLabel(text: string, lang: Lang): string {
  if (lang !== 'en') return text
  return sampleEn[text] ?? text
}
