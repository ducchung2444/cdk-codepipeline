import { Stage, StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeployEnvEnum } from "lib/context/types";
// import { LambdaWithDepStack } from "lib/constructs/lambda_with_dep";
import { NetworkStack } from "lib/stacks/network-stack";
import { StatelessResourceStack } from "lib/stacks/stateless-stack";

interface AppStageProps extends StageProps {
  deployEnv: DeployEnvEnum;
  status: "on" | "off";
}

export class AppStage extends Stage {
  constructor(scope: Construct, id: string, props: AppStageProps) {
    super(scope, id, props);

    const { env, deployEnv, status } = props;

    // new LambdaWithDepStack(this, "LambdaWithDepStack", {
    //   stage,
    // });

    const networkStack = new NetworkStack(this, 'BaseNetwork', {
      stackName: `${deployEnv}-network`,
      env: env,
      deployEnv: deployEnv,
    });

    const statelessResourceStack = new StatelessResourceStack(this, 'StatelessResource', {
      stackName: `${deployEnv}-stateless-resource`,
      env: env,
      vpc: networkStack.vpc,
      deployEnv: deployEnv,
      infraStatus: status
    });

    statelessResourceStack.addDependency(networkStack);
  }
}
