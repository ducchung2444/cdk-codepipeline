import { StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppStage } from "./app-stage";
import { DeployEnvEnum } from "lib/context/types";

interface StgStageProps extends StageProps {
  status: "on" | "off";
}

export class StgStage extends AppStage {
  constructor(scope: Construct, id: string, props: StgStageProps) {
    super(scope, id, {
      ...props,
      deployEnv: DeployEnvEnum.STG,
      status: props.status,
    });
  }
}
