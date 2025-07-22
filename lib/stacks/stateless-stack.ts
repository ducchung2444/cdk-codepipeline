/**
 * Stateless resources.
 * Load Balancer, Compute Resources (EC2, ECS, Lambda), Deploy Pipelines
 * Security Groups, IAM permissions.
 */

import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_ec2 as ec2,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_certificatemanager as certificatemanager,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_elasticloadbalancingv2 as lbv2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_logs as logs,
  aws_iam as iam,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_codebuild as codebuild,
  aws_codedeploy as codedeploy,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfront_origins,
  aws_elasticache as elasticache,
  aws_ssm as ssm,
  aws_events as events,
  aws_events_targets as events_targets,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeployEnvEnum } from "@/context/types";

interface StatelessResourceProps extends StackProps {
  deployEnv: DeployEnvEnum;
  vpc: ec2.Vpc;
  infraStatus: "on" | "off";
}

export class StatelessResourceStack extends Stack {
  public readonly backendService: ecs.FargateService;
  public readonly cluster: ecs.Cluster;
  constructor(scope: Construct, id: string, props: StatelessResourceProps) {
    super(scope, id, props);

    const { deployEnv, vpc, infraStatus } = props;

    this.cluster = new ecs.Cluster(this, `${deployEnv}-cluster`, {
      vpc: vpc,
      clusterName: `learn-cluster-${deployEnv}`,
      enableFargateCapacityProviders: true,
    });

    const taskDefBackend = new ecs.FargateTaskDefinition(
      this,
      `${deployEnv}-Backend-taskDef`
    );

    const backendECRRepo = new ecr.Repository(this, `${deployEnv}-Backend-ecrRepo`, {
      repositoryName: `backend-${deployEnv}`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    taskDefBackend.addContainer("backendContainer", {
      image: ecs.ContainerImage.fromEcrRepository(backendECRRepo),
      portMappings: [
        {
          containerPort: 8080,
        },
      ],
      secrets: {

      },
      environment: {

      },
      stopTimeout: Duration.seconds(120),
    });

    this.backendService = new ecs.FargateService(
      this,
      `${deployEnv}-backend-service`,
      {
        cluster: this.cluster,
        taskDefinition: taskDefBackend,
        serviceName: "learn-backend-service",
        deploymentController: {
          type: ecs.DeploymentControllerType.CODE_DEPLOY,
        },
        desiredCount: infraStatus === "on" ? 1 : 0,
        assignPublicIp: true, //if not set, task will be place in private subnet
      }
    );
  }
}
