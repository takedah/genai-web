import { RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { HostedZone, IHostedZone, PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

// Interface 型エンドポイントは 1 つあたり月額約 $20（2 AZ）の固定費がかかるため、
// SDK 呼び出しの実態があるサービスのみ定義する。
// 新しい AWS サービスを使う機能を追加した場合はここへの追加を忘れないこと
// （closed-vpc.test.ts の期待値もあわせて更新する）。
const VPC_ENDPOINTS: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
  // VPC Endpoints required by user side (ブラウザから直接呼び出されるサービス)
  ApiGateway: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
  Lambda: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
  // Cognito VPC Endpoints (Private Link)
  CognitoIdp: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
  CognitoIdentity: new ec2.InterfaceVpcEndpointAwsService('cognito-identity'),
  // VPC Endpoints required by app side (VPC 内の Lambda / Fargate から呼び出されるサービス)
  Bedrock: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
  Transcribe: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE,
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
};

export interface ClosedVpcProps {
  readonly ipv4Cidr: string;
  readonly domainName?: string | null;
  readonly hostedZoneId?: string | null;
  // 専用線/VPN 越しの利用者端末（オンプレミス）側の CIDR リスト
  readonly allowedClientCidrs?: string[];
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

    // ブラウザは Cognito・API Gateway・Lambda・S3（署名付き URL）を VPC エンドポイント経由で
    // 直接呼び出すため、専用線/VPN 越しのオンプレミス端末の CIDR も許可する
    for (const cidr of props.allowedClientCidrs ?? []) {
      securityGroup.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(443));
    }

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
