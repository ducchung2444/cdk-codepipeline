#!/usr/bin/env bash
set -euo pipefail

# Fetch .env from SSM
aws ssm get-parameter --with-decryption --name "$ENV_SSM_PARAMETER" --output text --query 'Parameter.Value' > .env

# 2. Fetch infra status flags
INFRA_STATUS_DEV=$(aws ssm get-parameter --name "${INFRA_STATUS_SSM_DEV}" --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')
INFRA_STATUS_STG=$(aws ssm get-parameter --name "${INFRA_STATUS_SSM_STG}" --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')

# 3. Install Bun and set PATH
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

CDK_CONTEXT=(--context infraStatusDev="${INFRA_STATUS_DEV}" \
             --context infraStatusStg="${INFRA_STATUS_STG}")

# 4. Install deps, run tests, synthesize
bun install --frozen-lockfile
#bun x jest test/stacks/stateless-stack.test.ts
bun x cdk synth "${CDK_CONTEXT[@]}"


# Install ansi2html for rendering HTML diffs
pip3 install --root-user-action ansi2html

# Generate and convert CDK diff (stg)
{
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  FORCE_COLOR=1 bun x cdk diff "code-pipeline/StgStage/**" "${CDK_CONTEXT[@]}" 2>&1
} | ansi2html > cdk-diff-output-stg.html

# Generate and convert CDK diff (prod)
{
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  FORCE_COLOR=1 bun x cdk diff "code-pipeline/ProdStage/**" "${CDK_CONTEXT[@]}" 2>&1
} | ansi2html > cdk-diff-output-prod.html

# Upload diff HTML files to S3
aws s3 cp cdk-diff-output-stg.html \
  "s3://diff-file/${PROJECT}/cdk-diff-output-stg.html"

aws s3 cp cdk-diff-output-prod.html \
  "s3://diff-file/${PROJECT}/cdk-diff-output-prod.html"
