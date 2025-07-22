import { StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppStage } from "./app-stage";
import { DeployEnvEnum } from "@/context/types";

interface DevStageProps extends StageProps {
  status: "on" | "off";
}

export class DevStage extends AppStage {
  constructor(scope: Construct, id: string, props: DevStageProps) {
    super(scope, id, {
      ...props,
      deployEnv: DeployEnvEnum.DEV,
      status: props.status,
    });
  }
}
