#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-asia-northeast1}"
SA_NAME="${GCP_SERVICE_ACCOUNT_NAME:-state-machine-sa}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_NAME="state-machine-simulator"
REPO_NAME="state-machine-registry"
IMAGE_NAME="state-machine-app"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}"

echo "Deploying State Machine Simulator to Cloud Run..."
echo "Project: $PROJECT_ID | Region: $REGION"

# Create Artifact Registry repository if not exists
gcloud artifacts repositories describe "$REPO_NAME" \
  --project="$PROJECT_ID" --location="$REGION" &>/dev/null || \
gcloud artifacts repositories create "$REPO_NAME" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --repository-format=docker \
  --description="State Machine Simulator Docker images"

# Configure Docker auth
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Build and push Docker image
cd "$(dirname "$0")/../.."
docker build -t "${IMAGE}:latest" .
docker push "${IMAGE}:latest"

# Deploy to Cloud Run
gcloud run deploy "$SERVICE_NAME" \
  --image="${IMAGE}:latest" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --platform=managed \
  --min-instances=0 \
  --max-instances=2 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=80 \
  --service-account="$SA_EMAIL" \
  --set-env-vars="APP_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}" \
  --allow-unauthenticated \
  --quiet

URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)')

echo ""
echo "Deployment complete!"
echo "Service URL: $URL"
echo "Health check: ${URL}/health"
