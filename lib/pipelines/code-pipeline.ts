import { pipelines, Stack, StackProps, aws_iam as iam, aws_codepipeline as codepipeline } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppStage } from 'lib/stages/app-stage';
import { CODE_CONNECTION_ARN, REPO_BRANCH, REPO_STRING } from 'lib/configs/env';
import {
  PROJECT,
  ENV_SSM_PARAMETER,
  INFRA_STATUS_SSM_PARAMETER,
} from 'lib/configs/constants';
import { DeployEnvEnum } from 'lib/context/types';
import { KickPipelineLambdaConstruct } from 'lib/constructs/kick-pipeline-lambda';

interface CodePipelineStackProps extends StackProps {
  infraStatusDev: 'on' | 'off';
  infraStatusStg: 'on' | 'off';
}

export class CodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: CodePipelineStackProps) {
    super(scope, id, props);

    const { env, infraStatusStg } = props;

    const stgStage = new AppStage(this, 'StgStage', {
      env: env,
      status: infraStatusStg,
      deployEnv: DeployEnvEnum.STG,
      stageName: 'StgStage',
    });

    const prodStage = new AppStage(this, 'ProdStage', {
      env: env,
      status: 'on',
      deployEnv: DeployEnvEnum.PROD,
      stageName: 'ProdStage',
    });

    const base = new codepipeline.Pipeline(this, `${PROJECT}-cp`, {
      pipelineName: `${PROJECT}-cdk-pipeline`,
      pipelineType: codepipeline.PipelineType.V2,  // ← v2 required for pipeline variables & stage conditions
    });

    const pipeline = new pipelines.CodePipeline(this, `learn-code-pipeline`, {
      codePipeline: base,
      synth: new pipelines.CodeBuildStep(`project-synth`, {
        input: pipelines.CodePipelineSource.connection(REPO_STRING, REPO_BRANCH, { connectionArn: CODE_CONNECTION_ARN }),
        buildEnvironment: {
          environmentVariables: {
            ENV_SSM_PARAMETER: { value: ENV_SSM_PARAMETER },
            INFRA_STATUS_SSM_DEV: { value: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV] },
            INFRA_STATUS_SSM_STG: { value: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG] },
            PROJECT: { value: PROJECT },
          },
        },
        commands: [
          // 'chmod +x assets/codepipeline/commands.bash',
          'bash ./assets/codepipeline/commands.bash',
        ],
        rolePolicyStatements: [
          // ssm
          new iam.PolicyStatement({
            resources: [
              `arn:aws:ssm:${this.region}:${this.account}:parameter${ENV_SSM_PARAMETER}`,
              `arn:aws:ssm:${this.region}:${this.account}:parameter${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV]}`,
              `arn:aws:ssm:${this.region}:${this.account}:parameter${INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG]}`,
            ],
            actions: ['ssm:GetParameter*'],
          }),
          // cloudformation & ecr
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cloudformation:DescribeStacks',
              'cloudformation:GetTemplate',
              'cloudformation:ListStacks',
              'cloudformation:DescribeStackEvents',
              'cloudformation:DescribeStackResource',
              'cloudformation:DescribeStackResources',
              'cloudformation:GetTemplateSummary',
              'ecr:DescribeRepositories',
              'ecr:ListImages',
              'ecr:BatchGetImage',
              'ecr:GetDownloadUrlForLayer',
              'sts:AssumeRole',
            ],
            resources: ['*'],
          }),
          // iam
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iam:GetRole', 'iam:GetRolePolicy', 'iam:ListRolePolicies', 'iam:ListAttachedRolePolicies'],
            resources: ['*'],
          }),
          // s3
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetBucketLocation', 's3:ListBucket'],
            resources: ['arn:aws:s3:::diff-file', 'arn:aws:s3:::diff-file/*'],
          }),
        ],
      }),
    });

    pipeline.addStage(stgStage);
    pipeline.addStage(prodStage, {
      pre: [
        new pipelines.ManualApprovalStep('stg-deployment-approval', {
          comment: 'This is a comment',
          reviewUrl: 'https://infra.shirokumapower.jp/',
        }),
      ],
    });

    pipeline.buildPipeline();

    // Add a BeforeEntry → VariableCheck rule on the "Prod" stage to SKIP it unless TRIGGER_SOURCE == "github"
    const prodIndex = base.stages.findIndex(s => s.stageName === 'ProdStage');
    if (prodIndex === -1) {
      throw new Error('Prod stage not found in the generated pipeline');
    }

    const cfn = base.node.defaultChild as codepipeline.CfnPipeline;
    cfn.variables = [
      {
        name: 'TRIGGER_SOURCE',
        defaultValue: 'github', // default when the run is started by GitHub
        description: 'pipeline trigger source: github|lambda',
      },
    ];
    (cfn as codepipeline.CfnPipeline).addPropertyOverride(
      `Stages.${prodIndex}.BeforeEntry`,
      {
        Conditions: [
          {
            Result: 'SKIP',  // engage SKIP when the rule fails
            Rules: [
              {
                Name: "IsGithubTriggerRule",
                RuleTypeId: {
                  Category: 'Rule',
                  Owner: 'AWS',
                  Provider: 'VariableCheck',
                  Version: '1',
                },
                Configuration: {
                  Variable: '#{variables.TRIGGER_SOURCE}',  // pipeline-level variable
                  Value: 'github',
                  Operator: 'EQ',
                },
              },
            ],
          },
        ],
      },
    );

    new KickPipelineLambdaConstruct(this, "KickPipelineLambdaConstructStg", {
      deployEnv: DeployEnvEnum.STG,
      pipelineName: pipeline.pipeline.pipelineName,
      pipelineArn: pipeline.pipeline.pipelineArn,
      ssmParameterName: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG],
    });
  }
}
