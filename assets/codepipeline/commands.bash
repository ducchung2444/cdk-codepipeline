#!/usr/bin/env bash
set -euo pipefail

env | sort
echo "DEBUG: test new env $TEST_NEW_ENV"

# 1. Fetch .env from SSM
aws ssm get-parameter --with-decryption --name "$ENV_SSM_PARAMETER" --output text --query 'Parameter.Value' > .env

# 2. Fetch infra status flags
INFRA_STATUS_DEV=$(aws ssm get-parameter --name "$INFRA_STATUS_DEV" --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')
INFRA_STATUS_STG=$(aws ssm get-parameter --name "$INFRA_STATUS_STG" --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')

# 3. Install Bun and set PATH
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 4. Install deps, run tests, synthesize
bun install --frozen-lockfile
#bun x jest test/stacks/stateless-stack.test.ts
bun x cdk synth --context infraStatusDev=$INFRA_STATUS_DEV \
                --context infraStatusStg=$INFRA_STATUS_STG
