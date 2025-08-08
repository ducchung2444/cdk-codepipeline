import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CodePipelineStack } from "lib/pipelines/code-pipeline";


interface MainStackProps extends StackProps {
  infraStatusDev: "on" | "off";
  infraStatusStg: "on" | "off";
  trigger: string;
}

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    new CodePipelineStack(this, "code-pipeline-stack", {
      env: props.env,
      infraStatusDev: props.infraStatusDev,
      infraStatusStg: props.infraStatusStg,
      trigger: props.trigger,
    });
  }
}
