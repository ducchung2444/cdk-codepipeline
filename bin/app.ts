import 'source-map-support/register';
import * as cdk from "aws-cdk-lib";
import { MainStack } from "@/stacks/main-stack";
import { ACCOUNT, REGION } from "@/configs/env";

const app = new cdk.App();

console.log("infraStatusDev", app.node.tryGetContext("infraStatusDev"));
console.log("infraStatusStg", app.node.tryGetContext("infraStatusStg"));

const infraStatusDev = app.node.tryGetContext("infraStatusDev") != undefined ? app.node.tryGetContext("infraStatusDev") : "on";
if (infraStatusDev !== "on" && infraStatusDev !== "off")
  throw new Error('Invalid infra status. Only accept on or off');

const infraStatusStg = app.node.tryGetContext("infraStatusStg") != undefined ? app.node.tryGetContext("infraStatusStg") : "on";
if (infraStatusStg !== "on" && infraStatusStg !== "off")
  throw new Error('Invalid infra status. Only accept on or off');

new MainStack(app, "MainStack", {
  env: { account: ACCOUNT, region: REGION },
  infraStatusDev: infraStatusDev,
  infraStatusStg: infraStatusStg,
});
