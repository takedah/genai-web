import { RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { HostedZone, IHostedZone, PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

const VPC_ENDPOINTS: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
  // VPC Endpoints required by user side
  ApiGateway: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
  Lambda: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
  Transcribe: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE,
  Polly: ec2.InterfaceVpcEndpointAwsService.POLLY,
  // Cognito VPC Endpoints (Private Link)
  CognitoIdp: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
  CognitoIdentity: new ec2.InterfaceVpcEndpointAwsService('cognito-identity'),
  // VPC Endpoints required by app side
  Bedrock: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
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
  public readonly hostedZone: IHostedZone | undefined;

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

    // 閉域では通信の到達性の問題調査（SG・エンドポイント設定漏れ等）が難しいため、フローログを残す
    const flowLogGroup = new LogGroup(this, 'FlowLogGroup', {
      retention: RetentionDays.THREE_MONTHS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
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
        // 既存のプライベートホストゾーンを取り込む。
        // ゾーン名は domainName と一致している必要がある（ALB への A レコードはゾーン頂点に作成されるため）。
        // また、利用者がアクセスしてくるネットワーク（VPC）にそのゾーンが関連付け済みであることが前提。
        this.hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
          hostedZoneId: props.hostedZoneId,
          zoneName: props.domainName,
        });
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
