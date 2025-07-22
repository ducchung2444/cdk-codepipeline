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
    const taskDefBackend = new ecs.FargateTaskDefinition(
      this,
      `${deployEnv}-BackendTaskDef`,
    );

    const backendRepo = new ecr.Repository(this, `${deployEnv}-BackendRepo`, {
      repositoryName: `backend-${deployEnv}`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    taskDefBackend.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo),
      portMappings: [{ containerPort: 8080 }],
      stopTimeout: Duration.seconds(120),
    });

    /* ---------------------------------------------------------------------
       Application Load Balancer
    --------------------------------------------------------------------- */
    const lbSecurityGroup = new ec2.SecurityGroup(this, `${deployEnv}-learn-LoadBalancerSecurityGroup`, {
      vpc: vpc,
      allowAllOutbound: true,
    });
    lbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow inbound traffic on port 443");    
    
    const loadBalancer = new lbv2.ApplicationLoadBalancer(this, `${deployEnv}-learn-alb`, {
      loadBalancerName: `${deployEnv}-learn-alb`,
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      internetFacing: true,
      securityGroup: lbSecurityGroup,
    });

    const httpListener = loadBalancer.addListener("listenerHttp", {
      port: 80,
      protocol: lbv2.ApplicationProtocol.HTTP,
      defaultAction: lbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/html",
        messageBody: "get out"
      }),
    });

        /* ---------------------------------------------------------------------
       ECS Service (CodeDeploy deployment controller)
    --------------------------------------------------------------------- */
    this.backendService = new ecs.FargateService(
      this,
      `${deployEnv}-BackendService`,
      {
        cluster: this.cluster,
        taskDefinition: taskDefBackend,
        serviceName: 'learn-backend-service',
        deploymentController: {
          type: ecs.DeploymentControllerType.CODE_DEPLOY,
        },
        desiredCount: infraStatus === 'on' ? 1 : 0,
        assignPublicIp: true,
      },
    );

    const backendBlueTg = httpListener.addTargets(`blueBackendTarget${deployEnv}`, {
      priority: 1,
      conditions: [ // if priority, must have conditions
        lbv2.ListenerCondition.pathPatterns(['/api/*']),
      ],
      port: 8080,
      protocol: lbv2.ApplicationProtocol.HTTP,
      targets: [this.backendService],
      healthCheck: {
        path: "/ping"
      },
    });

    const backendGreenTg = new lbv2.ApplicationTargetGroup(this, `greenBackendTarget${deployEnv}`, {
      vpc: vpc,
      port: 8080,
      protocol: lbv2.ApplicationProtocol.HTTP,
      targetType: lbv2.TargetType.IP,
      healthCheck: {
        path: "/ping"
      },
    });
    //Deploy
    const ecsDeployBackendGroup = new codedeploy.EcsDeploymentGroup(this, 'backendBlueGreenDG', {
      service: this.backendService,
      blueGreenDeploymentConfig: {
        blueTargetGroup: backendBlueTg,
        greenTargetGroup: backendGreenTg,
        listener: httpListener,
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
    });
  }
}
