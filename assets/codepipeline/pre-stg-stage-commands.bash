#!/usr/bin/env bash
set -euo pipefail

# Get trigger source with github as default
TRIGGER_SOURCE=$(aws ssm get-parameter --name "${PIPELINE_TRIGGER_SOURCE_SSM_PARAMETER}" --output text --query 'Parameter.Value' 2>/dev/null || echo 'github')

if [ "$TRIGGER_SOURCE" != "github" ]; then
  echo "Skipping prod deployment - trigger source is '$TRIGGER_SOURCE' (expected 'github')"
  exit 1
fi
