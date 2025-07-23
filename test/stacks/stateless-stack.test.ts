/**
 * @file   test/stateless-resource.test.ts
 * @brief  Ensures desiredCount = 1 when infraStatus = "on", and 0 when "off".
 *
 * To run:
 *   npm i -D jest @types/jest ts-jest aws-cdk-lib@2.202.0 constructs
 *   npx jest
 */

import { App, Stack } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Template } from 'aws-cdk-lib/assertions';
import { StatelessResourceStack } from 'lib/stacks/stateless-stack';
import { DeployEnvEnum } from 'lib/context/types';   // adjust path if different
import { NetworkStack } from 'lib/stacks/network-stack';

/**
 * Builds a StatelessResourceStack with the given infraStatus and
 * returns the synthesized CloudFormation template.
 */
function synthesize(infraStatus: 'on' | 'off') {
  const app = new App();
  // Re-create a dummy VPC for every synthesis to keep stacks independent
  const networkStack = new NetworkStack(app, `NetworkStack-${infraStatus}`, {
    env: { account: '111111111111', region: 'us-east-1' }, // any dummy env
    deployEnv: DeployEnvEnum.DEV,
  });

  const stateless = new StatelessResourceStack(app, `Stateless-${infraStatus}`, {
    env: { account: '111111111111', region: 'us-east-1' }, // any dummy env
    deployEnv: DeployEnvEnum.DEV,
    vpc: networkStack.vpc,
    infraStatus,
  });

  return Template.fromStack(stateless);
}

describe('StatelessResourceStack desiredCount', () => {
  test('desiredCount is 1 when infraStatus="on"', () => {
    const template = synthesize('on');
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 1,
    });
  });

  test('desiredCount is 0 when infraStatus="off"', () => {
    const template = synthesize('off');
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 0,
    });
  });
});
