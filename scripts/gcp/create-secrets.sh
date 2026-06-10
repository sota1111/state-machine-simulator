#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"

echo "Creating secrets in Secret Manager for project: $PROJECT_ID"
echo "You will be prompted to enter secret values."
echo ""

# ANTHROPIC_API_KEY
if gcloud secrets describe ANTHROPIC_API_KEY --project="$PROJECT_ID" &>/dev/null; then
  echo "Secret ANTHROPIC_API_KEY already exists. Skipping."
else
  read -r -s -p "Enter ANTHROPIC_API_KEY (leave blank to skip): " ANTHROPIC_API_KEY
  echo ""
  if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -n "$ANTHROPIC_API_KEY" | gcloud secrets create ANTHROPIC_API_KEY \
      --project="$PROJECT_ID" --data-file=-
    echo "Created ANTHROPIC_API_KEY"
  else
    echo "Skipping ANTHROPIC_API_KEY (not required for basic operation)"
  fi
fi

echo "Secrets setup complete"
