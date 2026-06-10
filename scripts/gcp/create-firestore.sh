#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-asia-northeast1}"

echo "Creating Firestore database in project: $PROJECT_ID"

gcloud firestore databases create \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --type=firestore-native 2>/dev/null || echo "Firestore database already exists"

echo "Firestore setup complete"
