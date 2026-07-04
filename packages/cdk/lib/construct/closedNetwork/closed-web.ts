import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { IVpc, Peer, Port, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { NetworkMode, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  OperatingSystemFamily,
} from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import {
  ApplicationLoadBalancer,
  ApplicationTargetGroup,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface ClosedWebProps {
  readonly vpc: IVpc;
  readonly encryptionKey: kms.IKey;
  // For HTTPS listener
  readonly hostedZone?: IHostedZone;
  readonly certificateArn?: string | null;
  // メンテナンスモード。true の場合、配信サーバーが全リクエストに maintenance.html を返す
  readonly maintenance: boolean;
  // 専用線/VPN 越しの利用者端末（オンプレミス）側の CIDR リスト
  readonly allowedClientCidrs?: string[];
}

export class ClosedWeb extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly alb: ApplicationLoadBalancer;
  public readonly fargateService: FargateService;
  public readonly targetGroup: ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: ClosedWebProps) {
    super(scope, id);

    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // スタック全体の方針（CMEK）に合わせる
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      enforceSSL: true,
    });

    // ALB アクセスログ用バケット。ELB のログ配送は SSE-KMS 非対応のため SSE-S3 とする
    const albAccessLogBucket = new s3.Bucket(this, 'AlbAccessLogBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(90) }],
    });

    const cluster = new Cluster(this, 'Cluster', { vpc: props.vpc });

    const certificate =
      props.hostedZone && props.certificateArn
        ? Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
        : undefined;

    const httpsProps =
      certificate && props.hostedZone
        ? {
            certificate,
            domainZone: props.hostedZone,
          }
        : {};

    // VPC エンドポイントの SG と同じ方針で、リスナーへの接続元を
    // VPC CIDR + 利用者端末（オンプレミス）側 CIDR に制限する
    const albSecurityGroup = new SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    const listenerPort = certificate ? 443 : 80;
    albSecurityGroup.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(listenerPort));

    for (const cidr of props.allowedClientCidrs ?? []) {
      albSecurityGroup.addIngressRule(Peer.ipv4(cidr), Port.tcp(listenerPort));
    }

    const loadBalancer = new ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      securityGroup: albSecurityGroup,
    });

    loadBalancer.logAccessLogs(albAccessLogBucket, 'alb-access-logs');

    const service = new ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      // 2 AZ 構成を活かすため常時 2 タスク（1 タスクだと AZ 障害・タスク入れ替え時に単一点になる）
      desiredCount: 2,
      // デプロイ中も desiredCount を下回らないようにする（旧タスクを残したまま新タスクを起動）
      minHealthyPercent: 100,
      taskImageOptions: {
        image: ContainerImage.fromAsset('./fargate-s3-server', {
          platform: Platform.LINUX_AMD64,
          networkMode: NetworkMode.DEFAULT,
        }),
        containerPort: 8080,
        environment: {
          BUCKET_NAME: bucket.bucketName,
          MAINTENANCE: props.maintenance.toString(),
        },
      },
      loadBalancer,
      publicLoadBalancer: false,
      // 起動に失敗するイメージをデプロイした場合に自動ロールバックする
      circuitBreaker: { rollback: true },
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.X86_64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
      taskSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      // リスナーSGを全開放（0.0.0.0/0）にする既定動作を止め、上記の VPC CIDR 制限を維持する
      openListener: false,
      ...httpsProps,
    });

    service.targetGroup.configureHealthCheck({
      path: '/healthcheck',
    });

    const target = service.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 20,
    });

    // メモリ使用率は静的ファイル配信の負荷と相関せずスケールインを阻害するため、CPU のみでスケールする
    target.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
    });

    bucket.grantRead(service.taskDefinition.taskRole);

    if (props.hostedZone) {
      new ARecord(this, 'LbRecord', {
        zone: props.hostedZone,
        target: RecordTarget.fromAlias(new LoadBalancerTarget(service.loadBalancer)),
      });
    }

    this.bucket = bucket;
    this.alb = service.loadBalancer;
    this.fargateService = service.service;
    this.targetGroup = service.targetGroup;
  }
}
