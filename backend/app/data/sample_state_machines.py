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
]
