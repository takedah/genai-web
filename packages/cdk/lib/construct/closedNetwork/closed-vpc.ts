import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

const VPC_ENDPOINTS: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
  // VPC Endpoints required by user side
  ApiGateway: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
  Lambda: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
  Transcribe: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE,
  Polly: ec2.InterfaceVpcEndpointAwsService.POLLY,
  AgentCore: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENTCORE,
  // Cognito VPC Endpoints (Private Link)
  CognitoIdp: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
  CognitoIdentity: new ec2.InterfaceVpcEndpointAwsService('cognito-identity'),
  // VPC Endpoints required by app side
  Bedrock: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
  BedrockAgent: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT_RUNTIME,
  BedrockAgentApi: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT,
  S3: ec2.InterfaceVpcEndpointAwsService.S3,
  Ecr: ec2.InterfaceVpcEndpointAwsService.ECR,
  EcrDocker: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
  CloudWatchLogs: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
  Sts: ec2.InterfaceVpcEndpointAwsService.STS,
  // Additional endpoints required for fork-specific features
  SecretsManager: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
  Sqs: ec2.InterfaceVpcEndpointAwsService.SQS,
  Kms: ec2.InterfaceVpcEndpointAwsService.KMS,
  Ses: ec2.InterfaceVpcEndpointAwsService.EMAIL,
  EventBridge: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE,
};

export interface ClosedVpcProps {
  readonly ipv4Cidr: string;
  readonly domainName?: string | null;
  readonly hostedZoneId?: string | null;
}

export class ClosedVpc extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;
  public readonly hostedZone: PrivateHostedZone | undefined;

  constructor(scope: Construct, id: string, props: ClosedVpcProps) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'ClosedVpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.ipv4Cidr),
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 20,
        },
      ],
    });

    vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    vpc.addGatewayEndpoint('DynamoDbGatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
    });

    securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443));

    for (const [name, service] of Object.entries(VPC_ENDPOINTS)) {
      const vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, `VpcEndpoint${name}`, {
        vpc,
        service,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [securityGroup],
        privateDnsEnabled: true,
      });

      if (name === 'ApiGateway') {
        this.apiGatewayVpcEndpoint = vpcEndpoint;
      }
    }

    if (props.domainName) {
      if (props.hostedZoneId) {
        // Note: PrivateHostedZone.fromHostedZoneId returns IHostedZone, not PrivateHostedZone.
        // For consistency, when an existing zone ID is provided we still construct a new PrivateHostedZone
        // is undesirable, so users that bring their own zone should NOT provide hostedZoneId here and instead
        // manage the A record outside the stack. We expose hostedZone as undefined in that case.
        this.hostedZone = undefined;
      } else {
        this.hostedZone = new PrivateHostedZone(this, 'HostedZone', {
          vpc,
          zoneName: props.domainName,
        });
      }
    }

    this.vpc = vpc;
  }
}
