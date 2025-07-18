import {
  pipelines,
  Stack,
  StackProps,
  aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DevStage } from "@/stages/dev-stage";
import { StgStage } from "@/stages/stg-stage";
import { CODE_CONNECTION_ARN, REPO_BRANCH, REPO_STRING } from "@/configs/env";
import { ENV_SSM_PARAMETER, INFRA_STATUS_SSM_PARAMETER } from "@/configs/constants";
import { DeployEnvEnum } from "@/context/types";

interface CodePipelineStackProps extends StackProps {
  infraStatusDev: "on" | "off";
  infraStatusStg: "on" | "off";
}

export class CodePipelineStack extends Stack {
  readonly pipelineName: string;
  readonly pipelineArn: string;

  constructor(scope: Construct, id: string, props: CodePipelineStackProps) {
    super(scope, id, props);

    const { env, infraStatusDev, infraStatusStg } = props;

    const devStage = new DevStage(this, "DevStage", {
      env: env,
      status: infraStatusDev,
    });

    const stgStage = new StgStage(this, "StgStage", {
      env: env,
      status: infraStatusStg,
    });

    const pipeline = new pipelines.CodePipeline(
      this,
      `learn-code-pipeline`,
      {
        synth: new pipelines.CodeBuildStep(`project-synth`, {
          input: pipelines.CodePipelineSource.connection(
            REPO_STRING,
            REPO_BRANCH,
            {
              connectionArn: CODE_CONNECTION_ARN,
            }
          ),
          commands: [
            `aws ssm get-parameter --with-decryption --name ${ENV_SSM_PARAMETER} --output text --query 'Parameter.Value' > .env`,
            `INFRA_STATUS_DEV=$(aws ssm get-parameter --name ${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV]} --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')`,
            `INFRA_STATUS_STG=$(aws ssm get-parameter --name ${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG]} --output text --query 'Parameter.Value' 2>/dev/null || echo 'on')`,
            `echo "INFRA_STATUS_DEV: $INFRA_STATUS_DEV"`,
            `echo "INFRA_STATUS_STG: $INFRA_STATUS_STG"`,
            "curl -fsSL https://bun.sh/install | bash",
            'export PATH="$HOME/.bun/bin:$PATH"',
            'bun install',
            "bun x cdk synth --context infraStatusDev=$INFRA_STATUS_DEV --context infraStatusStg=$INFRA_STATUS_STG",
          ],
          rolePolicyStatements: [
            new iam.PolicyStatement({
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter${ENV_SSM_PARAMETER}`,
                `arn:aws:ssm:${this.region}:${this.account}:parameter${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV]}`,
                `arn:aws:ssm:${this.region}:${this.account}:parameter${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG]}`,
              ],
              actions: ["ssm:GetParameter*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "cloudformation:DescribeStacks",
                "cloudformation:GetTemplate",
                "cloudformation:ListStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:DescribeStackResource",
                "cloudformation:DescribeStackResources",
                "cloudformation:GetTemplateSummary",
                "ecr:DescribeRepositories",
                "ecr:ListImages",
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer",
                "sts:AssumeRole",
              ],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "iam:GetRole",
                "iam:GetRolePolicy",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
              ],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ssm:GetParameter", "ssm:GetParameters"],
              resources: ["*"],
            }),
          ],
        }),
      }
    );

    pipeline.addStage(devStage);

    pipeline.addStage(stgStage, {
      pre: [
        new pipelines.ManualApprovalStep("stg-deployment-approval", {
          comment: `Please confirm for learn diff at below link!`,
          reviewUrl: `https://infra.shirokumapower.jp/infra-diff?system=learn&env=stg`,
        }),
      ],
    });

    pipeline.buildPipeline();

    this.pipelineName = pipeline.pipeline.pipelineName;
    this.pipelineArn = pipeline.pipeline.pipelineArn;
  }
}
