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
  aws_elasticloadbalancingv2 as elbv2,
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
    /**
     * Load balancer
     */
    const lbSecurityGroup = new ec2.SecurityGroup(this, `${deployEnv}-learn-LoadBalancerSecurityGroup`, {
      vpc: vpc,
      allowAllOutbound: true,
    });
    lbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow inbound traffic on port 80");
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

    //default listener and rule
    loadBalancer.addListener("listenerHttp", {
      port: 80,
      defaultAction: lbv2.ListenerAction.redirect({ port: "443", protocol: lbv2.ApplicationProtocol.HTTPS })
    });

    const httpsListener = loadBalancer.addListener("listenerHttps", {
      port: 443,
      protocol: lbv2.ApplicationProtocol.HTTPS,
      certificates: [],
      defaultAction: lbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/html",
        messageBody: "Not found"
      }),
      sslPolicy: lbv2.SslPolicy.TLS12
    });
    
    const backendBlueTg = httpsListener.addTargets(`blueBackendTarget${deployEnv}`, {
      priority: 1,
      port: 8080,
      protocol: lbv2.ApplicationProtocol.HTTP,
      conditions: [
        lbv2.ListenerCondition.hostHeaders([`api.learn.com`]),
      ],
      targets: [this.backendService],
      healthCheck: {
        path: "/ping"
      },
    });
  }
}
