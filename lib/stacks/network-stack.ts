import {
  aws_ec2 as ec2,
  aws_route53 as route53,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeployEnvEnum } from "lib/context/types";
import { ENV_CONFIG } from "lib/configs/constants";

interface NetworkProps extends StackProps {
  deployEnv: DeployEnvEnum;
}

export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly hostZone: route53.HostedZone;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id, props);
    const { deployEnv } = props;
    /**
    | Feature                           | Price                                    | Notes                                                    |
    | --------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
    | **NAT Gateway**                   | \~\$0.045/hour + data                    | Avoid unless you really need internet in private subnets |
    | **VPC Endpoints (Interface)**     | \~\$0.01/hour per AZ                     | For private access to AWS services                       |
    | **Elastic IP (EIP)**              | Free if attached, \~\$0.005/hour if idle | One free per instance                                    |
    | **Traffic Mirroring / Flow Logs** | \$                                       | Based on usage and storage                               |
    | **VPN / Direct Connect**          | \$                                       | Advanced connectivity option                             |
     */
    this.vpc = new ec2.Vpc(this, `${deployEnv}-learn-vpc`, {
      vpcName: `${deployEnv}-learn-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(ENV_CONFIG[deployEnv].cidrBlock),
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
      natGateways: 0,
    });
    /**
     * Public Hosted Zone:      $0.50 per month (per hosted zone)
     * Private Hosted Zone:     $0.50 per month (per hosted zone per VPC)
     * DNS Queries:             $0.40–$0.60 per million queries/month
     */

    // this.hostZone = new route53.HostedZone(
    //   this,
    //   `${deployEnv}-learn-hostZone`,
    //   {
    //     zoneName: ENV_CONFIG[deployEnv].domainName,
    //     vpcs: [this.vpc],  // This implicitly makes it a private zone
    //   }
    // );
  }
}
