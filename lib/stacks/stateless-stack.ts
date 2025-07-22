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

    const { deployEnv, vpc, infraStatus } = props;

    /* ---------------------------------------------------------------------
       ECS Cluster
    --------------------------------------------------------------------- */
    this.cluster = new ecs.Cluster(this, `${deployEnv}-cluster`, {
      vpc,
      clusterName: `learn-cluster-${deployEnv}`,
      enableFargateCapacityProviders: true,
    });

    /* ---------------------------------------------------------------------
       Task definition + ECR
    --------------------------------------------------------------------- */
    const taskDef = new ecs.FargateTaskDefinition(
      this,
      `${deployEnv}-BackendTaskDef`,
    );

    const backendRepo = new ecr.Repository(this, `${deployEnv}-BackendRepo`, {
      repositoryName: `backend-${deployEnv}`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendContainer = taskDef.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo),
      portMappings: [{ containerPort: 8080 }],
      stopTimeout: Duration.seconds(120),
      environment: {}, // set if needed
      secrets: {},     // set if needed
    });

    /* ---------------------------------------------------------------------
       ECS Service (CodeDeploy deployment controller)
    --------------------------------------------------------------------- */
    this.backendService = new ecs.FargateService(
      this,
      `${deployEnv}-BackendService`,
      {
        cluster: this.cluster,
        taskDefinition: taskDef,
        serviceName: 'learn-backend-service',
        deploymentController: {
          type: ecs.DeploymentControllerType.CODE_DEPLOY,
        },
        platformVersion: ecs.FargatePlatformVersion.VERSION1_4, // required for B/G
        desiredCount: infraStatus === 'on' ? 1 : 0,
        assignPublicIp: true,
        healthCheckGracePeriod: Duration.seconds(60),
      },
    );

    /* ---------------------------------------------------------------------
       Application Load Balancer
    --------------------------------------------------------------------- */
    const albSg = new ec2.SecurityGroup(this, `${deployEnv}-ALBSG`, {
      vpc,
      allowAllOutbound: true,
      description: 'ALB security group',
    });
    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from anywhere',
    );

    const alb = new lbv2.ApplicationLoadBalancer(this, `${deployEnv}-alb`, {
      vpc,
      internetFacing: true,
      loadBalancerName: `${deployEnv}-learn-alb`,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: albSg,
    });

    const listener = alb.addListener(`${deployEnv}-listener`, {
      port: 80,
      protocol: lbv2.ApplicationProtocol.HTTP,
      defaultAction: lbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'Default response',
      }),
    });

    /* ---------------------------------------------------------------------
       Target groups (blue / green)
    --------------------------------------------------------------------- */
    const blueTG = new lbv2.ApplicationTargetGroup(
      this,
      `${deployEnv}-tg-blue`,
      {
        vpc,
        port: 8080,
        protocol: lbv2.ApplicationProtocol.HTTP,
        targetType: lbv2.TargetType.IP,
        healthCheck: { path: '/ping' },
<<<<<<< HEAD
        targets: [this.backendService],
=======
>>>>>>> 6cdae5a31d8566e4bd0c159059557a7d7eb5ffc9
      },
    );

    const greenTG = new lbv2.ApplicationTargetGroup(
      this,
      `${deployEnv}-tg-green`,
      {
        vpc,
        port: 8080,
        protocol: lbv2.ApplicationProtocol.HTTP,
        targetType: lbv2.TargetType.IP,
        healthCheck: { path: '/ping' },
        targets: [this.backendService],
      },
    );

    // Primary rule to BLUE
    listener.addTargetGroups(`${deployEnv}-listener-blue`, {
      targetGroups: [blueTG],
      conditions: [lbv2.ListenerCondition.hostHeaders(['api.learn.com'])],
      priority: 1,
    });

    /* ---------------------------------------------------------------------
       CodeDeploy blue/green config
    --------------------------------------------------------------------- */
    const cdApp = new codedeploy.EcsApplication(
      this,
      `${deployEnv}-EcsCdApp`,
      {
        applicationName: `${deployEnv}-ecs-codedeploy-app`,
      },
    );

    new codedeploy.EcsDeploymentGroup(
      this,
      `${deployEnv}-EcsCdDeploymentGroup`,
      {
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
        autoRollback: { failedDeployment: true },
      },
    );
  }
}
