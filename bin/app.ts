import 'source-map-support/register';
import * as cdk from "aws-cdk-lib";
import { CodePipelineStack } from "lib/pipelines/code-pipeline";
import { ACCOUNT, REGION } from "lib/configs/env";

const app = new cdk.App();

const infraStatusDev = app.node.tryGetContext("infraStatusDev") ?? "on";
const infraStatusStg = app.node.tryGetContext("infraStatusStg") ?? "on";

new CodePipelineStack(app, 'code-pipeline', {
  env: { account: ACCOUNT, region: REGION },
  infraStatusDev: infraStatusDev,
  infraStatusStg: infraStatusStg,
});
