#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"

echo "Creating secrets in Secret Manager for project: $PROJECT_ID"
echo "You will be prompted to enter secret values."
echo ""

# GEMINI_API_KEY
if gcloud secrets describe GEMINI_API_KEY --project="$PROJECT_ID" &>/dev/null; then
  echo "Secret GEMINI_API_KEY already exists. Skipping."
else
  read -r -s -p "Enter GEMINI_API_KEY (leave blank to skip): " GEMINI_API_KEY
  echo ""
  if [ -n "$GEMINI_API_KEY" ]; then
    echo -n "$GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
      --project="$PROJECT_ID" --data-file=-
    echo "Created GEMINI_API_KEY"
  else
    echo "Skipping GEMINI_API_KEY (not required for basic operation)"
  fi
fi

echo "Secrets setup complete"
