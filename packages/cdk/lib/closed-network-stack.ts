import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { ClosedVpc } from './construct/closedNetwork';
import { StackInput } from './stack-input';

export interface ClosedNetworkStackProps extends StackProps {
  readonly params: StackInput;
}

export class ClosedNetworkStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;
  public readonly hostedZone: PrivateHostedZone | undefined;

  constructor(scope: Construct, id: string, props: ClosedNetworkStackProps) {
    super(scope, id, props);

    const {
      closedNetworkVpcCidr,
      closedNetworkDomainName,
      closedNetworkPrivateHostedZoneId,
      modelRegion,
    } = props.params;

    if (this.region !== modelRegion) {
      throw new Error(
        `The app region and modelRegion must match in closed network mode (got ${this.region} vs ${modelRegion}).`,
      );
    }

    const closedVpc = new ClosedVpc(this, 'ClosedVpc', {
      ipv4Cidr: closedNetworkVpcCidr,
      domainName: closedNetworkDomainName,
      hostedZoneId: closedNetworkPrivateHostedZoneId,
    });

    this.vpc = closedVpc.vpc;
    this.apiGatewayVpcEndpoint = closedVpc.apiGatewayVpcEndpoint;
    this.hostedZone = closedVpc.hostedZone;
  }
}
