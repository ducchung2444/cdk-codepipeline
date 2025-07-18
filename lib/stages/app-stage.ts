import { DeployEnvEnum } from "@/context/types";
import { Stage, StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { LambdaWithDepStack } from "@/constructs/lambda_with_dep";

interface AppStageProps extends StageProps {
  stage: DeployEnvEnum;
  status: "on" | "off";
}

export class AppStage extends Stage {
  constructor(scope: Construct, id: string, props: AppStageProps) {
    super(scope, id, props);

    const { env, stage, status } = props;

    new LambdaWithDepStack(this, "LambdaWithDepStack", {
      stage,
    });
  }
}
