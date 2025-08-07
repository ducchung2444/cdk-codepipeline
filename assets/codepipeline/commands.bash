#!/usr/bin/env bash
set -euo pipefail

env | sort

# 1. Fetch .env from SSM
aws ssm get-parameter --with-decryption --name "$ENV_SSM_PARAMETER" --output text --query 'Parameter.Value' > .env

# 2. Fetch infra status flags
INFRA_STATUS_DEV=$(aws ssm get-parameter --name "$INFRA_STATUS_SSM_DEV" --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')
INFRA_STATUS_STG=$(aws ssm get-parameter --name "$INFRA_STATUS_SSM_STG" --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')

# 3. Install Bun and set PATH
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 4. Install deps, run tests, synthesize
bun install --frozen-lockfile
#bun x jest test/stacks/stateless-stack.test.ts
bun x cdk synth --context infraStatusDev=$INFRA_STATUS_DEV \
                --context infraStatusStg=$INFRA_STATUS_STG


# Install ansi2html for rendering HTML diffs
pip3 install ansi2html

set -x

# Generate and convert CDK diff (dev)
{
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  FORCE_COLOR=1 npx cdk diff "CDKPipelineStack/dev/**" \
    -c infraStatusDev="${INFRA_STATUS_DEV}" \
    -c infraStatusStg="${INFRA_STATUS_STG}" 2>&1
} | ansi2html > cdk-diff-output-dev.html

# Generate and convert CDK diff (stg)
{
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  FORCE_COLOR=1 npx cdk diff "CDKPipelineStack/stg/**" \
    -c infraStatusDev="${INFRA_STATUS_DEV}" \
    -c infraStatusStg="${INFRA_STATUS_STG}" 2>&1
} | ansi2html > cdk-diff-output-stg.html

# Upload diff HTML files to S3
aws s3 cp cdk-diff-output-dev.html \
  "s3://diff-file/${PROJECT}/cdk-diff-output-dev.html"

aws s3 cp cdk-diff-output-stg.html \
  "s3://diff-file/${PROJECT}/cdk-diff-output-stg.html"
