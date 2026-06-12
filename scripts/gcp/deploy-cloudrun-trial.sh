#!/usr/bin/env bash
set -euo pipefail

# Cloud Run 試験デプロイスクリプト (state-machine-simulator)
# APP_ENV=local で Firestore なしで動作確認する。
#
# 使い方:
#   GCP_PROJECT_ID=your-project-id \
#   AUTH_PASSWORD=your-password \
#   JWT_SECRET=your-jwt-secret \
#   bash scripts/gcp/deploy-cloudrun-trial.sh

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="state-machine-simulator"
REPO_NAME="state-machine-registry"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

AUTH_PASSWORD="${AUTH_PASSWORD:?AUTH_PASSWORD is required}"
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}"

echo "== Cloud Run 試験デプロイ: ${SERVICE_NAME} =="
echo "Project: ${PROJECT_ID} | Region: ${REGION}"

# Artifact Registry リポジトリ作成（なければ）
gcloud artifacts repositories describe "${REPO_NAME}" \
  --project="${PROJECT_ID}" --location="${REGION}" &>/dev/null || \
gcloud artifacts repositories create "${REPO_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --repository-format=docker \
  --description="State Machine Simulator Docker images"

# Cloud Build でビルド & プッシュ（ローカル Docker 不要）
cd "$(dirname "$0")/../.."
gcloud builds submit . \
  --project="${PROJECT_ID}" \
  --tag="${IMAGE}:latest" \
  --timeout=600s

# Cloud Run へデプロイ
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}:latest" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --min-instances=0 \
  --max-instances=2 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=80 \
  --set-env-vars="APP_ENV=local,AUTH_PASSWORD=${AUTH_PASSWORD},JWT_SECRET=${JWT_SECRET}" \
  --allow-unauthenticated \
  --quiet

URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(status.url)')

echo ""
echo "== デプロイ完了 =="
echo "Service URL: ${URL}"
echo "Health check: ${URL}/health"
