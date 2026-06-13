#!/usr/bin/env bash
set -euo pipefail

# ローカル gcloud CLI 認証による Cloud Run デプロイスクリプト
# (state-machine-simulator)
#
# 使い方:
#   cp .env.example .env
#   # .env を編集して必要な値を設定
#   source .env && bash scripts/deploy_local_gcp.sh
#
# または:
#   GCP_PROJECT_ID=your-project-id \
#   AUTH_PASSWORD=your-password \
#   JWT_SECRET=your-jwt-secret \
#   bash scripts/deploy_local_gcp.sh

# 必要な環境変数の読み込み（.env が存在すれば）
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# 必須変数の確認
PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-state-machine-simulator}"
ARTIFACT_REPO="${ARTIFACT_REGISTRY_REPOSITORY:-state-machine-registry}"
IMAGE_NAME_VAR="${IMAGE_NAME:-state-machine-app}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${IMAGE_NAME_VAR}"

AUTH_PASSWORD="${AUTH_PASSWORD:?AUTH_PASSWORD is required}"
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}"

echo "== Cloud Run デプロイ: ${SERVICE_NAME} =="
echo "Project: ${PROJECT_ID} | Region: ${REGION}"
echo "Image: ${IMAGE}"
echo ""

# gcloud 認証状態の確認
echo "--- gcloud 認証確認 ---"
gcloud auth list --format="value(account)" 2>/dev/null | head -1 || {
  echo "ERROR: gcloud 未認証。'gcloud auth login' を実行してください。"
  exit 1
}

# gcloud project 設定の確認
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "${CURRENT_PROJECT}" != "${PROJECT_ID}" ]; then
  echo "プロジェクトを設定します: ${PROJECT_ID}"
  gcloud config set project "${PROJECT_ID}"
fi

# Artifact Registry Docker 認証の設定
echo "--- Artifact Registry 認証設定 ---"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Artifact Registry リポジトリ作成（なければ）
echo "--- Artifact Registry リポジトリ確認 ---"
gcloud artifacts repositories describe "${ARTIFACT_REPO}" \
  --project="${PROJECT_ID}" --location="${REGION}" &>/dev/null || \
gcloud artifacts repositories create "${ARTIFACT_REPO}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --repository-format=docker \
  --description="State Machine Simulator Docker images"

# Cloud Build でビルド & プッシュ（ローカル Docker 不要）
echo "--- Docker ビルド & プッシュ (Cloud Build) ---"
cd "$(dirname "$0")/.."
gcloud builds submit . \
  --project="${PROJECT_ID}" \
  --tag="${IMAGE}:latest" \
  --timeout=600s

# Cloud Run へデプロイ
echo "--- Cloud Run デプロイ ---"

# Secret Manager: 初回デプロイ前に以下を実行してください
# echo -n "value" | gcloud secrets create state-machine-auth-password --data-file=- --project=$PROJECT_ID
# echo -n "value" | gcloud secrets create state-machine-jwt-secret --data-file=- --project=$PROJECT_ID
# gcloud projects add-iam-policy-binding $PROJECT_ID \
#   --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
#   --role="roles/secretmanager.secretAccessor"

gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}:latest" \
  --set-secrets="AUTH_PASSWORD=state-machine-auth-password:latest,JWT_SECRET=state-machine-jwt-secret:latest" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --min-instances=0 \
  --max-instances=2 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=80 \
  --set-env-vars="APP_ENV=local,DATABASE_URL=sqlite:////tmp/app.db" \
  --allow-unauthenticated \
  --quiet

URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(status.url)')

echo ""
echo "== デプロイ完了 =="
echo "Service URL: ${URL}"
echo "Health check: ${URL}/health"
