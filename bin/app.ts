import 'source-map-support/register';
import * as cdk from "aws-cdk-lib";
import { MainStack } from "lib/stacks/main-stack";
import { ACCOUNT, REGION } from "lib/configs/env";

const app = new cdk.App();

console.log("DEBUG: infraStatusDev", app.node.tryGetContext("infraStatusDev"));
console.log("DEBUG: infraStatusStg", app.node.tryGetContext("infraStatusStg"));

const infraStatusDev = app.node.tryGetContext("infraStatusDev") ?? "on";
const infraStatusStg = app.node.tryGetContext("infraStatusStg") ?? "on";

new MainStack(app, "MainStack", {
  env: { account: ACCOUNT, region: REGION },
  infraStatusDev: infraStatusDev,
  infraStatusStg: infraStatusStg,
});
