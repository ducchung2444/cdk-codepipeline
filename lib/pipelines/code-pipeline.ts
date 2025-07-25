import {
  pipelines,
  Stack,
  StackProps,
  aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DevStage } from "lib/stages/dev-stage";
import { StgStage } from "lib/stages/stg-stage";
import { CODE_CONNECTION_ARN, REPO_BRANCH, REPO_STRING } from "lib/configs/env";
import { ENV_SSM_PARAMETER, INFRA_STATUS_SSM_PARAMETER } from "lib/configs/constants";
import { DeployEnvEnum } from "lib/context/types";

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
            "curl -fsSL https://bun.sh/install | bash",
            'export PATH="$HOME/.bun/bin:$PATH"',
            'bun install --frozen-lockfile',
            "bun x jest test/stacks/stateless-stack.test.ts",
            "bun x cdk synth --context infraStatusDev=$INFRA_STATUS_DEV --context infraStatusStg=$INFRA_STATUS_STG",
            "aws s3 cp --recursive cdk.out s3://ndc-learn-s3-codebuild-out/codebuild/cdkout"
          ],
          rolePolicyStatements: [
            // ssm
            new iam.PolicyStatement({
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter${ENV_SSM_PARAMETER}`,
                `arn:aws:ssm:${this.region}:${this.account}:parameter${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV]}`,
                `arn:aws:ssm:${this.region}:${this.account}:parameter${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG]}`,
              ],
              actions: ["ssm:GetParameter*"],
            }),
            // cloudformation & ecr
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
            // iam
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
            // ssm
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ssm:GetParameter", "ssm:GetParameters"],
              resources: ["*"],
            }),
            // s3, to save cdk.out
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetBucketLocation",
                "s3:ListBucket",
              ],
              resources: [
                "arn:aws:s3:::ndc-learn-s3-codebuild-out",
                "arn:aws:s3:::ndc-learn-s3-codebuild-out/*",
              ],
            }),
          ],
          /** This tells CodePipeline “treat cdk.out as my artifact”. */
          primaryOutputDirectory: 'cdk.out',
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
