import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CodePipelineStack } from "@/pipelines/code-pipeline";
import { INFRA_STATUS_SSM_PARAMETER } from "@/configs/constants";
import { DeployEnvEnum } from "@/context/types";
import { KickPipelineLambdaConstruct } from "@/constructs/kick-pipeline-lambda";

interface MainStackProps extends StackProps {
  infraStatusDev: "on" | "off";
  infraStatusStg: "on" | "off";
}

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const codePipelineStack = new CodePipelineStack(this, "CodePipelineStack", {
      env: props.env,
      infraStatusDev: props.infraStatusDev,
      infraStatusStg: props.infraStatusStg,
    });

    new KickPipelineLambdaConstruct(this, "KickPipelineLambdaConstructDev", {
      deployEnv: DeployEnvEnum.DEV,
      pipelineName: codePipelineStack.pipelineName,
      pipelineArn: codePipelineStack.pipelineArn,
      ssmParameterName: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.DEV],
    });

    new KickPipelineLambdaConstruct(this, "KickPipelineLambdaConstructStg", {
      deployEnv: DeployEnvEnum.STG,
      pipelineName: codePipelineStack.pipelineName,
      pipelineArn: codePipelineStack.pipelineArn,
      ssmParameterName: INFRA_STATUS_SSM_PARAMETER[DeployEnvEnum.STG],
    });
  }
}
