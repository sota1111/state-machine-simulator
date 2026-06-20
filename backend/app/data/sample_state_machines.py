SAMPLE_STATE_MACHINES = [
    {
        "name": "ログインフロー (Login Flow)",
        "description": "A simple authentication flow",
        "initial_state": "Logged Out",
        "states": [
            {"name": "Logged Out", "is_terminal": False},
            {"name": "Authenticating", "is_terminal": False},
            {"name": "Logged In", "is_terminal": False},
            {"name": "Login Failed", "is_terminal": False}
        ],
        "transitions": [
            {"from_state": "Logged Out", "to_state": "Authenticating", "event": "submit_credentials"},
            {"from_state": "Authenticating", "to_state": "Logged In", "event": "auth_success"},
            {"from_state": "Authenticating", "to_state": "Login Failed", "event": "auth_failure"},
            {"from_state": "Login Failed", "to_state": "Logged Out", "event": "retry"},
            {"from_state": "Logged In", "to_state": "Logged Out", "event": "logout"}
        ]
    },
    {
        "name": "注文フロー (Order Flow)",
        "description": "E-commerce order lifecycle",
        "initial_state": "Cart",
        "states": [
            {"name": "Cart", "is_terminal": False, "parent": "注文受付"},
            {"name": "Checkout", "is_terminal": False, "parent": "注文受付"},
            {"name": "Payment Processing", "is_terminal": False, "parent": "決済処理"},
            {"name": "Confirmed", "is_terminal": False, "parent": "決済処理"},
            {"name": "Shipped", "is_terminal": False, "parent": "配送"},
            {"name": "Delivered", "is_terminal": True, "parent": "配送"},
            {"name": "Cancelled", "is_terminal": True, "parent": "キャンセル"}
        ],
        "transitions": [
            {"from_state": "Cart", "to_state": "Checkout", "event": "proceed_to_checkout"},
            {"from_state": "Checkout", "to_state": "Payment Processing", "event": "submit_payment"},
            {"from_state": "Payment Processing", "to_state": "Confirmed", "event": "payment_confirmed"},
            {"from_state": "Confirmed", "to_state": "Shipped", "event": "ship_order"},
            {"from_state": "Shipped", "to_state": "Delivered", "event": "deliver_order"},
            {"from_state": "Checkout", "to_state": "Cancelled", "event": "cancel"},
            {"from_state": "Payment Processing", "to_state": "Checkout", "event": "payment_failed"}
        ]
    },
    {
        "name": "信号機 (Traffic Light)",
        "description": "Cyclic traffic light simulation",
        "initial_state": "Red",
        "states": [
            {"name": "Red", "is_terminal": False},
            {"name": "Green", "is_terminal": False},
            {"name": "Yellow", "is_terminal": False}
        ],
        "transitions": [
            {"from_state": "Red", "to_state": "Green", "event": "timer_expire"},
            {"from_state": "Green", "to_state": "Yellow", "event": "timer_expire"},
            {"from_state": "Yellow", "to_state": "Red", "event": "timer_expire"}
        ]
    },
    {
        "name": "ドア (Door)",
        "description": "Simple door open/close state machine",
        "initial_state": "閉",
        "states": [
            {"name": "閉", "is_terminal": False},
            {"name": "開", "is_terminal": False}
        ],
        "transitions": [
            {"from_state": "閉", "to_state": "開", "event": "開ける"},
            {"from_state": "開", "to_state": "閉", "event": "閉める"}
        ]
    },
    {
        "name": "自動販売機 (Vending Machine)",
        "description": "Simple vending machine workflow",
        "initial_state": "待機",
        "states": [
            {"name": "待機", "is_terminal": False},
            {"name": "選択", "is_terminal": False},
            {"name": "支払", "is_terminal": False},
            {"name": "排出", "is_terminal": False}
        ],
        "transitions": [
            {"from_state": "待機", "to_state": "選択", "event": "商品選択"},
            {"from_state": "選択", "to_state": "支払", "event": "コイン投入"},
            {"from_state": "支払", "to_state": "排出", "event": "確定"},
            {"from_state": "排出", "to_state": "待機", "event": "完了"},
            {"from_state": "選択", "to_state": "待機", "event": "キャンセル"}
        ]
    },
    {
        "name": "ロボット保守ワークフロー (Robot Maintenance)",
        "description": "Maintenance workflow for industrial robots",
        "initial_state": "問い合わせ受付",
        "states": [
            {"name": "問い合わせ受付", "is_terminal": False, "parent": "受付・分析"},
            {"name": "原因分析", "is_terminal": False, "parent": "受付・分析"},
            {"name": "ベンダー対応", "is_terminal": False, "parent": "修理対応"},
            {"name": "自社保守対応", "is_terminal": False, "parent": "修理対応"},
            {"name": "完了確認", "is_terminal": False, "parent": "完了処理"},
            {"name": "完了", "is_terminal": True, "parent": "完了処理"}
        ],
        "transitions": [
            {"from_state": "問い合わせ受付", "to_state": "原因分析", "event": "分析開始"},
            {"from_state": "原因分析", "to_state": "ベンダー対応", "event": "ベンダー依頼"},
            {"from_state": "原因分析", "to_state": "自社保守対応", "event": "内部修理"},
            {"from_state": "ベンダー対応", "to_state": "完了確認", "event": "修理完了報告"},
            {"from_state": "自社保守対応", "to_state": "完了確認", "event": "修理完了"},
            {"from_state": "完了確認", "to_state": "完了", "event": "確認OK"},
            {"from_state": "完了確認", "to_state": "原因分析", "event": "再調査必要"}
        ]
    },
    {
        "name": "半導体製造装置 (Semiconductor Equipment)",
        "description": "High-level state machine for semiconductor manufacturing tool",
        "initial_state": "電源投入",
        "states": [
            {"name": "電源投入", "is_terminal": False, "parent": "起動"},
            {"name": "初期化中", "is_terminal": False, "parent": "起動"},
            {"name": "待機", "is_terminal": False, "parent": "稼働"},
            {"name": "レシピ設定", "is_terminal": False, "parent": "稼働"},
            {"name": "搬送中", "is_terminal": False, "parent": "稼働"},
            {"name": "処理中", "is_terminal": False, "parent": "稼働"},
            {"name": "アラーム", "is_terminal": False, "parent": "異常"},
            {"name": "非常停止", "is_terminal": False, "parent": "異常"}
        ],
        "transitions": [
            {"from_state": "電源投入", "to_state": "初期化中", "event": "起動"},
            {"from_state": "初期化中", "to_state": "待機", "event": "初期化完了"},
            {"from_state": "待機", "to_state": "レシピ設定", "event": "レシピ選択"},
            {"from_state": "レシピ設定", "to_state": "搬送中", "event": "開始"},
            {"from_state": "搬送中", "to_state": "処理中", "event": "搬送完了"},
            {"from_state": "処理中", "to_state": "待機", "event": "処理完了"},
            {"from_state": "待機", "to_state": "アラーム", "event": "エラー発生"},
            {"from_state": "処理中", "to_state": "アラーム", "event": "プロセスエラー"},
            {"from_state": "アラーム", "to_state": "待機", "event": "復旧"},
            {"from_state": "待機", "to_state": "非常停止", "event": "緊急停止ボタン"},
            {"from_state": "非常停止", "to_state": "初期化中", "event": "再起動"}
        ]
    },
    {
        "name": "SaaS営業フロー (SaaS Sales)",
        "description": "Sales pipeline for a SaaS product",
        "initial_state": "リード獲得",
        "states": [
            {"name": "リード獲得", "is_terminal": False, "parent": "アプローチ"},
            {"name": "コンタクト済み", "is_terminal": False, "parent": "アプローチ"},
            {"name": "ヒアリング中", "is_terminal": False, "parent": "商談"},
            {"name": "提案中", "is_terminal": False, "parent": "商談"},
            {"name": "承認待ち", "is_terminal": False, "parent": "商談"},
            {"name": "見積提出", "is_terminal": False, "parent": "商談"},
            {"name": "受注", "is_terminal": True, "parent": "クローズ"},
            {"name": "失注", "is_terminal": True, "parent": "クローズ"}
        ],
        "transitions": [
            {"from_state": "リード獲得", "to_state": "コンタクト済み", "event": "メール送信"},
            {"from_state": "コンタクト済み", "to_state": "ヒアリング中", "event": "商談セット"},
            {"from_state": "ヒアリング中", "to_state": "提案中", "event": "デモ実施"},
            {"from_state": "提案中", "to_state": "承認待ち", "event": "稟議申請"},
            {"from_state": "承認待ち", "to_state": "見積提出", "event": "承認完了"},
            {"from_state": "見積提出", "to_state": "受注", "event": "成約"},
            {"from_state": "提案中", "to_state": "失注", "event": "競合敗退"},
            {"from_state": "見積提出", "to_state": "失注", "event": "予算NG"},
            {"from_state": "失注", "to_state": "提案中", "event": "再提案"}
        ]
    },
    {
        "name": "ai-dev-control-plane Issue実行パイプライン",
        "description": "Issue実行状態 × Worker状態 × キュー状態 (autonomous runner)",
        "initial_state": "Issue created",
        "states": [
            {"name": "Issue created", "is_terminal": False, "parent": "Webhookイベント種別"},
            {"name": "Issue updated", "is_terminal": False, "parent": "Webhookイベント種別"},
            {"name": "priority changed", "is_terminal": False, "parent": "Webhookイベント種別"},
            {"name": "status changed", "is_terminal": False, "parent": "Webhookイベント種別"},
            {"name": "Urgent", "is_terminal": False, "parent": "Issue優先度"},
            {"name": "High", "is_terminal": False, "parent": "Issue優先度"},
            {"name": "Medium", "is_terminal": False, "parent": "Issue優先度"},
            {"name": "Low", "is_terminal": False, "parent": "Issue優先度"},
            {"name": "No priority", "is_terminal": False, "parent": "Issue優先度"},
            {"name": "親Issueなし", "is_terminal": False, "parent": "Issue構造"},
            {"name": "親Issueあり", "is_terminal": False, "parent": "Issue構造"},
            {"name": "子Issueあり", "is_terminal": False, "parent": "Issue構造"},
            {"name": "先頭", "is_terminal": False, "parent": "Queue上の位置"},
            {"name": "親Issue直後", "is_terminal": False, "parent": "Queue上の位置"},
            {"name": "優先度順", "is_terminal": False, "parent": "Queue上の位置"},
            {"name": "通常末尾", "is_terminal": False, "parent": "Queue上の位置"},
            {"name": "未登録", "is_terminal": False, "parent": "Queue状態"},
            {"name": "実行待ち", "is_terminal": False, "parent": "Queue状態"},
            {"name": "ロック待ち", "is_terminal": False, "parent": "Queue状態"},
            {"name": "実行中", "is_terminal": False, "parent": "Queue状態"},
            {"name": "retry予定", "is_terminal": False, "parent": "Queue状態"},
            {"name": "完了", "is_terminal": False, "parent": "Queue状態"},
            {"name": "失敗", "is_terminal": False, "parent": "Queue状態"},
            {"name": "Claude実行中", "is_terminal": False, "parent": "Worker状態"},
            {"name": "Gemini実行中", "is_terminal": False, "parent": "Worker状態"},
            {"name": "Codex実行中", "is_terminal": False, "parent": "Worker状態"},
            {"name": "usage-limit中", "is_terminal": False, "parent": "Worker状態"},
            {"name": "non-response", "is_terminal": False, "parent": "Worker状態"},
            {"name": "Todo", "is_terminal": False, "parent": "Linear Issue状態"},
            {"name": "In Progress", "is_terminal": False, "parent": "Linear Issue状態"},
            {"name": "Done", "is_terminal": True, "parent": "Linear Issue状態"},
            {"name": "Canceled", "is_terminal": True, "parent": "Linear Issue状態"}
        ],
        "transitions": [
            {"from_state": "Issue created", "to_state": "Issue updated", "event": "内容更新webhook"},
            {"from_state": "Issue created", "to_state": "priority changed", "event": "優先度変更webhook"},
            {"from_state": "Issue created", "to_state": "status changed", "event": "状態変更webhook"},
            {"from_state": "Issue created", "to_state": "未登録", "event": "受信(キュー未登録)"},
            {"from_state": "Issue created", "to_state": "Todo", "event": "Linear初期分類"},
            {"from_state": "status changed", "to_state": "Urgent", "event": "優先度=Urgent"},
            {"from_state": "Urgent", "to_state": "High", "event": "再分類High"},
            {"from_state": "High", "to_state": "Medium", "event": "再分類Medium"},
            {"from_state": "Medium", "to_state": "Low", "event": "再分類Low"},
            {"from_state": "Low", "to_state": "No priority", "event": "優先度なし"},
            {"from_state": "No priority", "to_state": "親Issueなし", "event": "構造判定:単独"},
            {"from_state": "親Issueなし", "to_state": "親Issueあり", "event": "親に紐付け"},
            {"from_state": "親Issueなし", "to_state": "子Issueあり", "event": "子Issue分解"},
            {"from_state": "親Issueあり", "to_state": "先頭", "event": "最優先で先頭挿入"},
            {"from_state": "親Issueあり", "to_state": "優先度順", "event": "優先度順挿入"},
            {"from_state": "子Issueあり", "to_state": "親Issue直後", "event": "親の直後に挿入"},
            {"from_state": "親Issueなし", "to_state": "通常末尾", "event": "末尾エンキュー"},
            {"from_state": "先頭", "to_state": "実行待ち", "event": "エンキュー完了"},
            {"from_state": "親Issue直後", "to_state": "実行待ち", "event": "エンキュー完了"},
            {"from_state": "優先度順", "to_state": "実行待ち", "event": "エンキュー完了"},
            {"from_state": "通常末尾", "to_state": "実行待ち", "event": "エンキュー完了"},
            {"from_state": "未登録", "to_state": "実行待ち", "event": "キュー登録"},
            {"from_state": "実行待ち", "to_state": "ロック待ち", "event": "デキュー試行"},
            {"from_state": "ロック待ち", "to_state": "実行中", "event": "ロック取得"},
            {"from_state": "ロック待ち", "to_state": "実行待ち", "event": "ロック取得失敗"},
            {"from_state": "実行中", "to_state": "Claude実行中", "event": "Claude起動"},
            {"from_state": "Claude実行中", "to_state": "Gemini実行中", "event": "実装委譲"},
            {"from_state": "Gemini実行中", "to_state": "Codex実行中", "event": "検証委譲"},
            {"from_state": "Claude実行中", "to_state": "usage-limit中", "event": "上限到達"},
            {"from_state": "Gemini実行中", "to_state": "non-response", "event": "worker無応答"},
            {"from_state": "Codex実行中", "to_state": "non-response", "event": "worker無応答"},
            {"from_state": "usage-limit中", "to_state": "non-response", "event": "cooldown継続"},
            {"from_state": "non-response", "to_state": "Claude実行中", "event": "Claudeフォールバック"},
            {"from_state": "Codex実行中", "to_state": "完了", "event": "検証完了"},
            {"from_state": "実行中", "to_state": "retry予定", "event": "一時失敗"},
            {"from_state": "実行中", "to_state": "失敗", "event": "致命的エラー"},
            {"from_state": "retry予定", "to_state": "実行待ち", "event": "再エンキュー"},
            {"from_state": "失敗", "to_state": "retry予定", "event": "リトライ可能"},
            {"from_state": "Todo", "to_state": "In Progress", "event": "着手"},
            {"from_state": "完了", "to_state": "In Progress", "event": "PR作成同期"},
            {"from_state": "In Progress", "to_state": "Done", "event": "merge完了同期"},
            {"from_state": "In Progress", "to_state": "Canceled", "event": "中止"},
            {"from_state": "Todo", "to_state": "Canceled", "event": "キャンセル"}
        ]
    },
    {
        "name": "ai-dev-control-plane アプリ配備・認証状態",
        "description": "アプリ種別 × 認証方式 × Cloud Run公開状態 × Secret状態",
        "initial_state": "state-machine-simulator",
        "states": [
            {"name": "state-machine-simulator", "is_terminal": False, "parent": "アプリ種別"},
            {"name": "english-phrase-trainer", "is_terminal": False, "parent": "アプリ種別"},
            {"name": "toddler-private-rag", "is_terminal": False, "parent": "アプリ種別"},
            {"name": "stock-signal-research", "is_terminal": False, "parent": "アプリ種別"},
            {"name": "kindle-sale-monitor", "is_terminal": False, "parent": "アプリ種別"},
            {"name": "booking-monitor", "is_terminal": False, "parent": "アプリ種別"},
            {"name": "simple password", "is_terminal": False, "parent": "認証方式"},
            {"name": "JWT", "is_terminal": False, "parent": "認証方式"},
            {"name": "Firebase Auth", "is_terminal": False, "parent": "認証方式"},
            {"name": "ALLOWED_USER_EMAILS制御", "is_terminal": False, "parent": "認証方式"},
            {"name": "Firebase API Key未登録", "is_terminal": False, "parent": "Secret状態"},
            {"name": "Secret Manager登録済み", "is_terminal": False, "parent": "Secret状態"},
            {"name": "Cloud Run注入済み", "is_terminal": False, "parent": "Secret状態"},
            {"name": "アプリ側未参照", "is_terminal": False, "parent": "Secret状態"},
            {"name": "authenticatedのみ", "is_terminal": False, "parent": "Cloud Run公開状態"},
            {"name": "unauthenticated許可", "is_terminal": False, "parent": "Cloud Run公開状態"},
            {"name": "/login到達不可", "is_terminal": False, "parent": "Cloud Run公開状態"},
            {"name": "/login到達可能", "is_terminal": True, "parent": "Cloud Run公開状態"}
        ],
        "transitions": [
            {"from_state": "state-machine-simulator", "to_state": "english-phrase-trainer", "event": "次アプリ"},
            {"from_state": "english-phrase-trainer", "to_state": "toddler-private-rag", "event": "次アプリ"},
            {"from_state": "toddler-private-rag", "to_state": "stock-signal-research", "event": "次アプリ"},
            {"from_state": "stock-signal-research", "to_state": "kindle-sale-monitor", "event": "次アプリ"},
            {"from_state": "kindle-sale-monitor", "to_state": "booking-monitor", "event": "次アプリ"},
            {"from_state": "booking-monitor", "to_state": "simple password", "event": "認証方式選択"},
            {"from_state": "simple password", "to_state": "JWT", "event": "JWTへ移行"},
            {"from_state": "JWT", "to_state": "Firebase Auth", "event": "Firebase Authへ移行"},
            {"from_state": "Firebase Auth", "to_state": "ALLOWED_USER_EMAILS制御", "event": "許可リスト適用"},
            {"from_state": "Firebase Auth", "to_state": "Firebase API Key未登録", "event": "初期Secret状態"},
            {"from_state": "Firebase API Key未登録", "to_state": "Secret Manager登録済み", "event": "Secret登録"},
            {"from_state": "Secret Manager登録済み", "to_state": "Cloud Run注入済み", "event": "--set-secrets"},
            {"from_state": "Cloud Run注入済み", "to_state": "アプリ側未参照", "event": "env名不一致"},
            {"from_state": "アプリ側未参照", "to_state": "Cloud Run注入済み", "event": "env名修正"},
            {"from_state": "Cloud Run注入済み", "to_state": "authenticatedのみ", "event": "デフォルト非公開デプロイ"},
            {"from_state": "authenticatedのみ", "to_state": "unauthenticated許可", "event": "--allow-unauthenticated"},
            {"from_state": "authenticatedのみ", "to_state": "/login到達不可", "event": "IAMで到達不可"},
            {"from_state": "アプリ側未参照", "to_state": "/login到達不可", "event": "Secret参照不可で500"},
            {"from_state": "unauthenticated許可", "to_state": "/login到達可能", "event": "公開かつroute正常"},
            {"from_state": "/login到達不可", "to_state": "/login到達可能", "event": "設定修正後"}
        ]
    }
]
