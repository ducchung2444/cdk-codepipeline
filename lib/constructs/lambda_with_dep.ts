import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { DeployEnvEnum } from "lib/context/types";

interface LambdaWithDepStackProps extends cdk.StackProps {
  deployEnv: DeployEnvEnum;
}

export class LambdaWithDepStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: LambdaWithDepStackProps) {
    super(scope, id, props);

    const backendFunction = new lambda.Function(this, "backend-function", {
      functionName: `${props?.deployEnv}-backend-function`,
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("assets/backend", {
        exclude: ["*", "!index.mjs", "!package.json", "!package-lock.json"],
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "cp -r /asset-input/* /asset-output/",
              "cd /asset-output",
              "npm install --omit=dev --cache /tmp/.npm",
              "rm -rf node_modules/.cache",
            ].join(" && "),
          ],
        },
      }),
      handler: "index.handler",
      environment: {
        TABLE_NAME: "test-table",
      },
    });
  }
}
