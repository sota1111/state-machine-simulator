# State Machine Simulator

自然言語で記述された仕様から状態遷移モデルを生成・可視化・シミュレーションできるMVPアプリケーション。

## プロジェクト概要

状態遷移仕様は設計書や要求仕様書に自然言語で記載されることが多く、レビューや設計時に状態や遷移の抜け漏れが発生しやすい。本ツールは自然言語入力からAI（Claude API）を使って状態遷移モデルを自動生成し、可視化・シミュレーションを可能にする。

## 起動方法

### 必要環境

- Python 3.11+
- Node.js 20+
- Anthropic API キー（自然言語解析機能を使用する場合）

### 環境変数の設定

```bash
cp .env.example .env
# .envを編集してANTHROPIC_API_KEYを設定
```

### バックエンド起動

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

起動後、http://localhost:8000/docs でAPIドキュメントを確認できます。

### フロントエンド起動（別ターミナル）

```bash
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開きます。

### Docker Compose を使った起動

```bash
cp .env.example .env
# .envにANTHROPIC_API_KEYを設定

docker-compose up
```

## データ構造

### StateMachine（状態遷移モデル）
| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | UUID | 一意のID |
| name | string | モデル名（ユニーク） |
| description | string | 説明 |
| initial_state | string | 初期状態名 |
| created_at | datetime | 作成日時 |
| updated_at | datetime | 更新日時 |
| is_deleted | bool | ソフトデリートフラグ |

### State（状態）
| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | UUID | 一意のID |
| machine_id | UUID | 所属モデルID |
| name | string | 状態名（モデル内でユニーク） |
| description | string | 説明 |
| is_terminal | bool | 終端状態フラグ |

### Transition（遷移）
| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | UUID | 一意のID |
| machine_id | UUID | 所属モデルID |
| from_state | string | 遷移元状態名 |
| to_state | string | 遷移先状態名 |
| event | string | トリガーイベント名 |

## アーキテクチャ概要

```
フロントエンド (React + Vite)  →  バックエンド (FastAPI)  →  SQLite
         ↓                               ↓
   Mermaid.js (状態遷移図)          Anthropic Claude API
   Recharts (グラフ)                (自然言語解析)
```

- **フロントエンド**: React 18 + TypeScript + Vite + TanStack Query + Tailwind CSS
- **バックエンド**: Python 3.11 + FastAPI + SQLAlchemy 2.x
- **データベース**: SQLite（`backend/data/app.db`）
- **NLP**: Anthropic Claude API（claude-sonnet-4-6）

## 制約事項

- 自然言語解析機能（`POST /api/parse`）にはANTHROPIC_API_KEYが必要
- APIキーなしでも、手動でモデル作成・編集・シミュレーションは可能（現バージョンでは直接API経由）
- SQLiteはローカル開発用。本番環境ではPostgreSQLへの移行を推奨
- 同時接続数が多い場合はパフォーマンスが低下する可能性がある

## 今後追加予定の機能

- [ ] 手動での状態遷移モデル作成UI（フォーム入力）
- [ ] モデルのエクスポート機能（JSON / PlantUML / Mermaid形式）
- [ ] ユーザー認証・マルチユーザー対応
- [ ] 状態遷移テストケース自動生成
- [ ] Webhook通知機能
- [ ] 複数モデルの比較機能

## サンプルシナリオ

起動直後から以下のサンプルデータが利用できます。

### 1. ログインフロー
```
Logged Out --[submit_credentials]--> Authenticating
Authenticating --[auth_success]--> Logged In
Authenticating --[auth_failure]--> Login Failed
Login Failed --[retry]--> Logged Out
Logged In --[logout]--> Logged Out
```

### 2. 注文フロー
```
Cart --[proceed_to_checkout]--> Checkout
Checkout --[submit_payment]--> Payment Processing
Payment Processing --[payment_confirmed]--> Confirmed
Confirmed --[ship_order]--> Shipped
Shipped --[deliver_order]--> Delivered
```

### 3. 信号機
```
Red --[timer_expire]--> Green
Green --[timer_expire]--> Yellow
Yellow --[timer_expire]--> Red
```

## 動作確認手順

### バックエンドAPIの確認

1. バックエンドを起動: `cd backend && uvicorn app.main:app --reload`
2. http://localhost:8000/docs を開く
3. `GET /api/models/` を実行してサンプルデータが3件あることを確認
4. サンプルモデルのIDをコピーして `GET /api/models/{id}/analysis` を実行

### フロントエンドの確認

1. フロントエンドを起動: `cd frontend && npm run dev`
2. http://localhost:5173 を開く
3. 一覧画面でサンプルデータ3件が表示されることを確認
4. いずれかのモデルの「詳細」ボタンをクリック
5. 状態遷移図（Mermaid.js）が表示されることを確認
6. シミュレーションパネルでイベントボタンをクリックして状態遷移を確認
7. ダッシュボード画面でグラフが表示されることを確認

### 自然言語解析の確認（ANTHROPIC_API_KEY設定済みの場合）

1. http://localhost:5173/input を開く
2. テキストエリアに状態遷移仕様を日本語で入力
   例: 「ユーザーがボタンを押すと処理中状態になります。処理が完了すると完了状態になり、エラーが発生するとエラー状態になります。」
3. 「AIで解析する」ボタンをクリック
4. 解析結果（状態・遷移一覧）が表示されることを確認
5. 「このモデルを保存する」をクリックして詳細画面に遷移することを確認
