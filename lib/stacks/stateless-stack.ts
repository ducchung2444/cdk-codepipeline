/**
 * Stateless resources:
 * – Application Load Balancer
 * – ECS Fargate service (blue/green via CodeDeploy)
 * – ECR repository
 * – Security groups, target groups, listener rules
 */

import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as lbv2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_codedeploy as codedeploy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeployEnvEnum } from 'lib/context/types';

interface StatelessResourceProps extends StackProps {
  deployEnv: DeployEnvEnum;
  vpc: ec2.Vpc;
  infraStatus: 'on' | 'off';
}

export class StatelessResourceStack extends Stack {
  public readonly backendService: ecs.FargateService;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: StatelessResourceProps) {
    super(scope, id, props);
  }
}
