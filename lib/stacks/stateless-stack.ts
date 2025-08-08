/**
 * Stateless resources:
 * – Application Load Balancer
 * – ECS Fargate service (blue/green via CodeDeploy)
 * – ECR repository
 * – Security groups, target groups, listener rules
 */

import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  RemovalPolicy,
  aws_s3 as s3,
  Stack,
  StackProps
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeployEnvEnum } from "lib/context/types";

interface StatelessResourceProps extends StackProps {
  deployEnv: DeployEnvEnum;
  vpc?: ec2.Vpc;
  infraStatus: "on" | "off";
}

export class StatelessResourceStack extends Stack {
  public readonly backendService: ecs.FargateService;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: StatelessResourceProps) {
    super(scope, id, props);

    const { deployEnv } = props;

    new s3.Bucket(this, "chungdeptrai-codepipeline-bucket", {
      bucketName: `chungdeptrai-codepipeline-bucket-${deployEnv}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
