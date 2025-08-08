import { pipelines, Stack, StackProps, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppStage } from 'lib/stages/app-stage';
import { CODE_CONNECTION_ARN, REPO_BRANCH, REPO_STRING } from 'lib/configs/env';
import {
  ENV_SSM_PARAMETER,
  INFRA_STATUS_SSM_PARAMETER,
  LAMBDA_TRIGGER_TIMESTAMP_SSM_PARAMETER,
} from 'lib/configs/constants';
import { DeployEnvEnum } from 'lib/context/types';
import { KickPipelineLambdaConstruct } from 'lib/constructs/kick-pipeline-lambda';

interface CodePipelineStackProps extends StackProps {
  infraStatusDev: 'on' | 'off';
  infraStatusStg: 'on' | 'off';
  trigger: string;
}

export class CodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: CodePipelineStackProps) {
    super(scope, id, props);

    const { env, infraStatusDev, infraStatusStg, trigger } = props;

    const devStage = new AppStage(this, 'DevStage', {
      env: env,
      status: infraStatusDev,
      deployEnv: DeployEnvEnum.DEV,
    });

    const stgStage = new AppStage(this, 'StgStage', {
      env: env,
      status: infraStatusStg,
      deployEnv: DeployEnvEnum.STG,
    });

    const pipeline = new pipelines.CodePipeline(this, `learn-code-pipeline`, {
      synth: new pipelines.CodeBuildStep(`project-synth`, {
        input: pipelines.CodePipelineSource.connection(REPO_STRING, REPO_BRANCH, { connectionArn: CODE_CONNECTION_ARN }),
        // buildEnvironment: {
        //   environmentVariables: {
        //     ENV_SSM_PARAMETER: { value: ENV_SSM_PARAMETER },
        //     INFRA_STATUS_SSM_DEV: { value: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV] },
        //     INFRA_STATUS_SSM_STG: { value: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG] },
        //     PROJECT: { value: 'learn-codepipeline' },
        //     TRIGGER_VAR: { value: '#{variables.TRIGGER}' },
        //   },
        // },
        env: {
          ENV_SSM_PARAMETER: ENV_SSM_PARAMETER,
          INFRA_STATUS_SSM_DEV: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV],
          INFRA_STATUS_SSM_STG: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG],
          LAMBDA_TRIGGER_TIMESTAMP_SSM_PARAMETER: LAMBDA_TRIGGER_TIMESTAMP_SSM_PARAMETER,
          PROJECT: 'learn-codepipeline',
        },
        commands: ['chmod +x assets/codepipeline/commands.bash', './assets/codepipeline/commands.bash'],
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
          // ssm
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ssm:GetParameter', 'ssm:GetParameters'],
            resources: ['*'],
          }),
          // s3, to save cdk.out
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetBucketLocation', 's3:ListBucket'],
            resources: ['arn:aws:s3:::diff-file', 'arn:aws:s3:::diff-file/*'],
          }),
        ],
        /** This tells CodePipeline “treat cdk.out as my artifact”. */
        primaryOutputDirectory: 'cdk.out',
      }),
    });

    pipeline.addStage(devStage);
    pipeline.addStage(stgStage, {
      pre: [
        ...(trigger !== 'github'
          ? [new pipelines.CodeBuildStep('exit', { commands: ['exit 1'] })]
          : []),
        new pipelines.ManualApprovalStep('prod-deployment-approval', {
          comment: 'comment',
          reviewUrl: 'https://infra.shirokumapower.jp/',
        }),
      ],
    });
    pipeline.buildPipeline();

    new KickPipelineLambdaConstruct(this, 'KickPipelineLambdaConstructDev', {
      deployEnv: DeployEnvEnum.DEV,
      pipelineName: pipeline.pipeline.pipelineName,
      pipelineArn: pipeline.pipeline.pipelineArn,
      ssmParameterName: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV],
    });

    // new KickPipelineLambdaConstruct(this, "KickPipelineLambdaConstructStg", {
    //   deployEnv: DeployEnvEnum.STG,
    //   pipelineName: pipeline.pipeline.pipelineName,
    //   pipelineArn: pipeline.pipeline.pipelineArn,
    //   ssmParameterName: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG],
    // });
  }
}
