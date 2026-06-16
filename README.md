# State Machine Simulator

自然言語で記述された仕様から状態遷移モデルを生成・可視化・シミュレーションできるMVPアプリケーション。

## プロジェクト概要

状態遷移仕様は設計書や要求仕様書に自然言語で記載されることが多く、レビューや設計時に状態や遷移の抜け漏れが発生しやすい。本ツールは自然言語入力からAI（Claude API）を使って状態遷移モデルを自動生成し、可視化・シミュレーションを可能にする。

## 認証情報なし開発クイックスタート

**Anthropic APIキーなしで即座にローカル動作確認が可能です。**

手動作成モードを使用するため、Claude APIへの接続は不要です。

```bash
# 1. リポジトリのクローン
git clone https://github.com/sota1111/state-machine-simulator.git
cd state-machine-simulator

# 2. 環境変数設定（APIキーは省略可）
cp .env.example .env

# 3. 起動
docker compose up --build
```

アクセス: http://localhost:5173

**認証情報が不要な理由:**
- `ANTHROPIC_API_KEY` 未設定時は「手動作成モード」でステートマシンを作成できます
- ローカルデータはSQLiteに保存されます（GCP不要）
- AIによる自然言語解析が不要な場合は、APIキーなしで全機能を利用可能です

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
   HTML/SVG (状態遷移図)          Anthropic Claude API
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
- [ ] モデルのエクスポート機能（JSON / PlantUML形式）
- [x] ユーザー認証・マルチユーザー対応
- [ ] 状態遷移テストケース自動生成
- [ ] Webhook通知機能
- [ ] 複数モデルの比較機能

## サンプルシナリオ

起動直後から以下のサンプルデータが利用できます（※階層状態（parentStates等）を持つ複雑なサンプルは現在未対応です）。

### 1. ログインフロー (Login Flow)
```
Logged Out --[submit_credentials]--> Authenticating
Authenticating --[auth_success]--> Logged In
Authenticating --[auth_failure]--> Login Failed
Login Failed --[retry]--> Logged Out
Logged In --[logout]--> Logged Out
```

### 2. 注文フロー (Order Flow)
```
Cart --[proceed_to_checkout]--> Checkout
Checkout --[submit_payment]--> Payment Processing
Payment Processing --[payment_confirmed]--> Confirmed
Confirmed --[ship_order]--> Shipped
Shipped --[deliver_order]--> Delivered
```

### 3. 信号機 (Traffic Light)
```
Red --[timer_expire]--> Green
Green --[timer_expire]--> Yellow
Yellow --[timer_expire]--> Red
```

### 4. ドア (Door)
```
閉 --[開ける]--> 開
開 --[閉める]--> 閉
```

### 5. 自動販売機 (Vending Machine)
```
待機 --[商品選択]--> 選択
選択 --[コイン投入]--> 支払
支払 --[確定]--> 排出
排出 --[完了]--> 待機
```

### 6. ロボット保守ワークフロー (Robot Maintenance)
```
問い合わせ受付 --[分析開始]--> 原因分析
原因分析 --[ベンダー依頼]--> ベンダー対応
原因分析 --[内部修理]--> 自社保守対応
... (他)
```

### 7. 半導体製造装置 (Semiconductor Equipment)
```
電源投入 --[起動]--> 初期化中 --[初期化完了]--> 待機
待機 --[レシピ選択]--> レシピ設定 --[開始]--> 搬送中
... (他)
```

### 8. SaaS営業フロー (SaaS Sales)
```
リード獲得 --[メール送信]--> コンタクト済み
コンタクト済み --[商談セット]--> ヒアリング中
... (他)
```

## 動作確認手順

### バックエンドAPIの確認

1. バックエンドを起動: `cd backend && uvicorn app.main:app --reload`
2. http://localhost:8000/docs を開く
3. `GET /api/models/` を実行してサンプルデータが8件あることを確認
4. サンプルモデルのIDをコピーして `GET /api/models/{id}/analysis` を実行

### バックエンド自動テストの実行

```bash
cd backend
pip install -r requirements.txt -r requirements-test.txt
pytest
```

### フロントエンドの確認

1. フロントエンドを起動: `cd frontend && npm run dev`
2. http://localhost:5173 を開く
3. 一覧画面でサンプルデータ8件が表示されることを確認
4. いずれかのモデルの「詳細」ボタンをクリック
5. 状態遷移図（SVG）が表示されることを確認
6. シミュレーションパネルでイベントボタンをクリックして状態遷移を確認
7. ダッシュボード画面でグラフが表示されることを確認

### 自然言語解析の確認（ANTHROPIC_API_KEY設定済みの場合）

1. http://localhost:5173/input を開く
2. テキストエリアに状態遷移仕様を日本語で入力
   例: 「ユーザーがボタンを押すと処理中状態になります。処理が完了すると完了状態になり、エラーが発生するとエラー状態になります。」
3. 「AIで解析する」ボタンをクリック
4. 解析結果（状態・遷移一覧）が表示されることを確認
5. 「このモデルを保存する」をクリックして詳細画面に遷移することを確認

---

## クラウドデプロイ（GCP Cloud Run）

### アーキテクチャ概要（クラウド）

```
GitHub Actions（main merge）
  └─► Artifact Registry（Dockerイメージ）
        └─► Cloud Run Service（nginx + FastAPI + React）
              └─► Firestore（状態遷移モデル保存）
                    └─► Secret Manager（ANTHROPIC_API_KEY）
```

- **Cloud Run**: シングルコンテナ（nginx + FastAPI + React静的ファイル）
- **Firestore**: 状態遷移モデルの保存（APP_ENV=productionで自動切り替え）
- **min-instances=0**: リクエストなし時はコンテナ停止（コスト削減）
- **Artifact Registry**: Dockerイメージ管理

### 前提条件

- GCP プロジェクト作成済み（課金有効化済み）
- `gcloud` CLI インストール・認証済み
- Docker インストール済み
- GitHub リポジトリの Secrets 設定済み（後述）

### GCPセットアップ手順

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-northeast1
export GCP_SERVICE_ACCOUNT_NAME=state-machine-sa

# 1. 必要APIを有効化
bash scripts/gcp/enable-apis.sh

# 2. Firestoreデータベース作成
bash scripts/gcp/create-firestore.sh

# 3. Secret Manager にシークレット登録
bash scripts/gcp/create-secrets.sh

# 4. IAM権限設定
bash scripts/gcp/set-iam.sh

# 5. Cloud Run Service デプロイ（Docker buildを含む）
bash scripts/gcp/deploy-service.sh
```

### 環境変数一覧

| 変数名 | 説明 | 必須 | デフォルト |
|---|---|---|---|
| `APP_ENV` | 実行環境（local / production） | Yes | `local` |
| `ANTHROPIC_API_KEY` | Anthropic API キー | No（なければAI機能skip） | - |
| `DATABASE_URL` | SQLite DB パス（ローカルのみ） | ローカルのみ | - |
| `GCP_PROJECT_ID` | GCP プロジェクト ID | 本番必須 | - |
| `GCP_REGION` | GCP リージョン | 本番必須 | `asia-northeast1` |
| `FIRESTORE_DATABASE` | Firestore DB 名 | No | `(default)` |
| `CORS_ORIGINS` | CORS許可オリジン（カンマ区切り） | ローカルのみ | `http://localhost:5173` |
| `LOG_LEVEL` | ログレベル | No | `INFO` |
| `VITE_FIREBASE_API_KEY` | Firebase API Key | Yes | - |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes | - |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | Yes | - |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | Yes | - |
| `ALLOWED_USER_EMAILS` | 許可するメールアドレス（カンマ区切り） | Yes | - |
| `AUTH_SECRET` | セッション署名用シークレット | Yes | - |

## 認証 (Authentication)

本アプリケーションは、Firebase Authentication を使用したメールアドレス・パスワード認証機能を備えています。

### 設定方法

`.env` ファイルに以下の変数を設定してください。

```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
ALLOWED_USER_EMAILS=your-email1@example.com,your-email2@example.com
AUTH_SECRET=your-random-secret-key
```

### 利用方法

1. アプリケーションにアクセスするとログイン画面が表示されます。
2. Firebase Console で作成したメールアドレスとパスワードを入力してログインします。
3. `ALLOWED_USER_EMAILS` に設定されたメールアドレスのみがログイン可能です。
4. ログイン後は通常の機能が利用可能です。
5. ログアウトはナビゲーションバーの「ログアウト」ボタンから行えます。

### GCP Secret Manager セットアップ

本番環境（Cloud Run）では機密情報を Secret Manager で管理します。初回デプロイ前に以下のコマンドでシークレットを作成してください。

```bash
# セッション署名用シークレットの作成
echo -n "your-random-secret" | gcloud secrets create AUTH_SECRET --data-file=- --project=YOUR_PROJECT_ID

# 許可するメールアドレスの作成
echo -n "user1@example.com,user2@example.com" | gcloud secrets create ALLOWED_USER_EMAILS --data-file=- --project=YOUR_PROJECT_ID

# Cloud Run サービスアカウントへの権限付与
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

ローカル開発:
```bash
cp .env.example .env
# .env を編集
docker compose up --build
```

### Secret Manager 設定

```bash
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY \
  --project=$GCP_PROJECT_ID --data-file=-
```

### GitHub Actions 設定

Settings → Secrets and variables → Actions で以下を設定:

| Secret 名 | 説明 |
|---|---|
| `GCP_PROJECT_ID` | GCP プロジェクト ID |
| `GCP_REGION` | デプロイリージョン（例: `asia-northeast1`） |
| `GCP_SERVICE_ACCOUNT` | Cloud Run 実行用サービスアカウント |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation プロバイダ URL |

### サンプルデータについて

ローカル環境（APP_ENV=local）では起動時にサンプルデータが自動投入されます。
クラウド環境（APP_ENV=production）ではFirestoreへの自動投入はありません。
初回デプロイ後、アプリのUIからモデルを手動登録してください。

### コスト管理

| サービス | 無料枠 | 想定コスト |
|---|---|---|
| Cloud Run | 月200万リクエスト・360K GB秒 | min-instances=0で ~0円/月 |
| Firestore | 月50K読み取り/20K書き込み | 小規模利用で ~0円/月 |
| Artifact Registry | 0.5GB | 約数円/月 |
| Secret Manager | 月6アクセス無料 | ~0円/月 |
| **合計** | | **~数円/月（小規模利用時）** |

> ⚠️ 利用量が増えると課金が発生します。GCP コンソールで予算アラートを設定することを推奨します。

**予算アラートの設定:**
1. GCP Console → 課金 → 予算とアラート
2. 「予算を作成」→ 金額（例: 500円）を設定
3. アラート通知先のメールアドレスを設定

### Artifact Registry の古いイメージ削除

```bash
gcloud artifacts docker images list \
  asia-northeast1-docker.pkg.dev/$GCP_PROJECT_ID/state-machine-registry/state-machine-app \
  --filter="UPDATE_TIME < -P30D" --format="value(DIGEST)" | \
  xargs -I {} gcloud artifacts docker images delete \
    asia-northeast1-docker.pkg.dev/$GCP_PROJECT_ID/state-machine-registry/state-machine-app@{} \
    --quiet --delete-tags 2>/dev/null || true
```

### セキュリティ注意事項

- **`.env` をコミットしない** — `.gitignore` で除外済み
- **サービスアカウントキーをリポジトリに置かない** — Workload Identity Federation を使用
- **Cloud Run は unauthenticated アクセス許可**（MVP のため）
- 認証情報は Secret Manager で管理

## GCP デプロイ準備

### 概要

このアプリは FastAPI (Backend) + React (Frontend) 構成であり、Cloud Run にデプロイできます。

### コンテナ化

既存の Dockerfile を使用します:

```bash
# Backend
docker build -t state-machine-simulator-backend ./backend
docker run -p 8000:8000 --env-file .env state-machine-simulator-backend

# Frontend
docker build -t state-machine-simulator-frontend ./frontend
docker run -p 8080:8080 state-machine-simulator-frontend
```

### GCP 実行環境

- **Backend**: Cloud Run (ポート `8000`)
- **Frontend**: Cloud Run (ポート `8080`) または Firebase Hosting

### データ永続化について

現在 SQLite を使用しています。Cloud Run はステートレスなため、本番環境では以下を検討してください:

- **Cloud SQL** (PostgreSQL/MySQL) への移行
- **Firestore** への移行
- Cloud Run の起動時に Cloud Storage からDBファイルをマウント

現時点では SQLite のまま開発継続が可能です（実デプロイ時に移行検討）。

### 環境変数

| 変数名 | 説明 |
|--------|------|
| GEMINI_API_KEY / OPENAI_API_KEY | 生成AI API キー（Secret Manager 推奨） |

### 注意事項

- 実際の `.env` ファイルは Git 管理対象外 (`.gitignore` 設定済み)
- API キーは Cloud Run の環境変数設定または Secret Manager で管理してください

