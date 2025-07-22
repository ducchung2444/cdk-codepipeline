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
  aws_elasticloadbalancingv2 as lbv2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_codedeploy as codedeploy,
  aws_elasticloadbalancingv2_targets as elbv2Targets,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeployEnvEnum } from "lib/context/types";

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
    /**
     * Load balancer
     */
    const lbSecurityGroup = new ec2.SecurityGroup(this, `${deployEnv}-learn-LoadBalancerSecurityGroup`, {
      vpc: vpc,
      allowAllOutbound: true,
    });
    lbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow inbound traffic on port 80");

    const alb = new lbv2.ApplicationLoadBalancer(this, `${deployEnv}-alb`, {
      vpc,
      internetFacing: true,
      loadBalancerName: `${deployEnv}-learn-alb`,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: lbSecurityGroup,
    });

    const listener = alb.addListener(`${deployEnv}-listener`, {
      port: 80,
      protocol: lbv2.ApplicationProtocol.HTTP,
      defaultAction: lbv2.ListenerAction.fixedResponse(200, {
        contentType: "text/plain",
        messageBody: "Default response",
      }),
    });

    // Target Groups for blue/green
    const blueTG = new lbv2.ApplicationTargetGroup(this, `${deployEnv}-tg-blue`, {
      vpc,
      port: 8080,
      protocol: lbv2.ApplicationProtocol.HTTP,
      targetType: lbv2.TargetType.IP,
      healthCheck: { path: "/ping" },
    });

    const greenTG = new lbv2.ApplicationTargetGroup(this, `${deployEnv}-tg-green`, {
      vpc,
      port: 8080,
      protocol: lbv2.ApplicationProtocol.HTTP,
      targetType: lbv2.TargetType.IP,
      healthCheck: { path: "/ping" },
    });

    blueTG.addTarget(this.backendService);
    greenTG.addTarget(this.backendService);

    listener.addTargetGroups(`${deployEnv}-listener-tg`, {
      targetGroups: [blueTG],
      conditions: [lbv2.ListenerCondition.hostHeaders(["api.learn.com"])],
      priority: 1,
    });

    // CodeDeploy ECS Application and Deployment Group
    const cdApp = new codedeploy.EcsApplication(this, `${deployEnv}-cd-app`, {
      applicationName: `${deployEnv}-ecs-codedeploy-app`,
    });

    new codedeploy.EcsDeploymentGroup(this, `${deployEnv}-cd-deployment-group`, {
      application: cdApp,
      service: this.backendService,
      deploymentGroupName: `${deployEnv}-ecs-deployment-group`,
      blueGreenDeploymentConfig: {
        listener,
        blueTargetGroup: blueTG,
        greenTargetGroup: greenTG,
        deploymentApprovalWaitTime: Duration.minutes(0),
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      autoRollback: {
        failedDeployment: true,
      },
    });
  }
}
