import { Construct } from 'constructs';
import { aws_iam as iam, aws_lambda as lambda, aws_logs as logs, Duration } from 'aws-cdk-lib';
import { DeployEnvEnum } from 'lib/context/types';
import { ACCOUNT, REGION } from 'lib/configs/env';
import { INFRA_STATUS_SSM_PARAMETER } from 'lib/configs/constants';

interface KickPipelineLambdaConstructProps {
  deployEnv: DeployEnvEnum.DEV | DeployEnvEnum.STG;
  pipelineName: string;
  pipelineArn: string;
  ssmParameterName: string;
}

export class KickPipelineLambdaConstruct extends Construct {
  constructor(scope: Construct, id: string, props: KickPipelineLambdaConstructProps) {
    super(scope, id);

    const { deployEnv, pipelineName, pipelineArn, ssmParameterName } = props;

    const pipelineTriggerLambda = new lambda.Function(
      this,
      `cdkpipeline-trigger-${deployEnv}`,
      {
        functionName: `pipeline-trigger-${deployEnv}`,
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'pipeline-trigger.lambda_handler',
        code: lambda.Code.fromAsset('assets/codepipeline', {
          exclude: ['*', '!pipeline-trigger.py'],
        }),
        environment: {
          PIPELINE_NAME: pipelineName,
          INFRA_STATUS_SSM_PARAMETER_NAME: ssmParameterName,
        },
        timeout: Duration.minutes(5),
        logRetention: logs.RetentionDays.ONE_WEEK,
      }
    );
    // Grant permissions to the Lambda
    // permission to start the pipeline
    pipelineTriggerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'codepipeline:StartPipelineExecution',
          'codepipeline:GetPipelineState',
        ],
        resources: [pipelineArn],
      })
    );
    // permission to get/put the ssm parameter
    pipelineTriggerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:PutParameter', 'ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${REGION}:${ACCOUNT}:parameter${INFRA_STATUS_SSM_PARAMETER[deployEnv]}`,
        ],
      })
    );
  }
}
