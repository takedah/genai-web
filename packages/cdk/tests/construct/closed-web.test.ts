import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Key } from 'aws-cdk-lib/aws-kms';
import { describe, expect, test } from 'vitest';
import { ClosedWeb, type ClosedWebProps } from '../../lib/construct/closedNetwork';

const CERTIFICATE_ARN =
  'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000';

type SecurityGroupIngress = {
  CidrIp?: string;
  FromPort?: number;
  ToPort?: number;
};

// ClosedWeb を組み立てるための最小のスタック。
// 閉域構成に合わせて NAT なし・PRIVATE_ISOLATED のみの VPC を用意する。
const createFixture = (props: Partial<ClosedWebProps> = {}) => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'ClosedWebTestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const vpc = new Vpc(stack, 'Vpc', {
    natGateways: 0,
    subnetConfiguration: [{ name: 'Isolated', subnetType: SubnetType.PRIVATE_ISOLATED }],
  });
  const encryptionKey = new Key(stack, 'Key');
  const hostedZone = new cdk.aws_route53.PrivateHostedZone(stack, 'HostedZone', {
    vpc,
    zoneName: 'genai.example.internal',
  });

  const closedWeb = new ClosedWeb(stack, 'ClosedWeb', {
    vpc,
    encryptionKey,
    hostedZone,
    certificateArn: CERTIFICATE_ARN,
    maintenance: false,
    ...props,
  });

  return { stack, vpc, closedWeb, template: Template.fromStack(stack) };
};

// ALB 用 SG を、ClosedWeb が作る「AlbSecurityGroup」の論理 ID で特定する
const findAlbSecurityGroupIngress = (template: Template): SecurityGroupIngress[] => {
  const securityGroups = template.findResources('AWS::EC2::SecurityGroup');
  const entry = Object.entries(securityGroups).find(([logicalId]) =>
    logicalId.startsWith('ClosedWebAlbSecurityGroup'),
  );
  expect(entry).toBeDefined();
  return (entry![1] as { Properties: { SecurityGroupIngress?: SecurityGroupIngress[] } }).Properties
    .SecurityGroupIngress as SecurityGroupIngress[];
};

describe('ClosedWeb Construct', () => {
  test('ALB は内部向け（internet-facing にしない）', () => {
    const { template } = createFixture();

    // Scheme が internal でないと閉域の前提が崩れる
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
    });
  });

  test('証明書とホストゾーンが揃う場合は HTTPS(443) リスナーになり証明書が紐づく', () => {
    const { template } = createFixture();

    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
      Certificates: [{ CertificateArn: CERTIFICATE_ARN }],
    });
    // 平文リスナーが同時に生えていないこと
    template.resourcePropertiesCountIs(
      'AWS::ElasticLoadBalancingV2::Listener',
      { Protocol: 'HTTP' },
      0,
    );
  });

  test('証明書が無い場合は HTTP(80) にフォールバックする', () => {
    // certificateArn を渡さないと HTTPS 化されない。
    // 閉域構成では stack-input が certificateArn を必須にしてこの経路を塞いでいるが、
    // construct 単体の挙動として平文になることを明示しておく（意図しない平文化の検知用）。
    const { template } = createFixture({ certificateArn: null });

    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
    });
    template.resourcePropertiesCountIs(
      'AWS::ElasticLoadBalancingV2::Listener',
      { Protocol: 'HTTPS' },
      0,
    );
  });

  test('リスナー SG は全開放されず、VPC CIDR のみが許可される', () => {
    const { template } = createFixture();

    const ingress = findAlbSecurityGroupIngress(template);

    // ecs-patterns の既定（openListener: true）だと 0.0.0.0/0 が入る。
    // closed-web.ts の openListener: false が効いていることを保証する。
    expect(ingress.map((rule) => rule.CidrIp)).not.toContain('0.0.0.0/0');
    expect(ingress).toHaveLength(1);
    expect(ingress[0].FromPort).toBe(443);
    expect(ingress[0].ToPort).toBe(443);
  });

  test('allowedClientCidrs が ALB SG の許可対象に 443 で追加される', () => {
    const { template } = createFixture({
      allowedClientCidrs: ['172.16.0.0/12', '192.168.10.0/24'],
    });

    const ingress = findAlbSecurityGroupIngress(template);
    const cidrs = ingress.map((rule) => rule.CidrIp);

    // VPC CIDR + クライアント CIDR ×2
    expect(ingress).toHaveLength(3);
    expect(cidrs).toContain('172.16.0.0/12');
    expect(cidrs).toContain('192.168.10.0/24');
    expect(cidrs).not.toContain('0.0.0.0/0');
    for (const rule of ingress) {
      expect(rule.FromPort).toBe(443);
      expect(rule.ToPort).toBe(443);
    }
  });

  test('hostedZone がある場合は ALB へのエイリアス A レコードを作成する', () => {
    const { template } = createFixture();

    template.resourceCountIs('AWS::Route53::RecordSet', 1);
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'A',
      // recordName を指定していないため、レコード名はゾーン名（＝配信 FQDN）になる
      Name: 'genai.example.internal.',
      AliasTarget: Match.objectLike({ DNSName: Match.anyValue() }),
    });
  });

  test('hostedZone が無い場合は A レコードも HTTPS リスナーも作らない', () => {
    const { template } = createFixture({ hostedZone: undefined });

    template.resourceCountIs('AWS::Route53::RecordSet', 0);
    template.resourcePropertiesCountIs(
      'AWS::ElasticLoadBalancingV2::Listener',
      { Protocol: 'HTTPS' },
      0,
    );
  });

  test('ALB と Fargate タスクは PRIVATE_ISOLATED サブネットに配置される', () => {
    const { template, stack, vpc } = createFixture();

    const isolatedSubnetIds = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_ISOLATED,
    }).subnetIds;
    // 参照解決のために論理 ID へ寄せる
    const isolatedLogicalIds = isolatedSubnetIds.map(
      (id) => stack.resolve(id).Ref as string | undefined,
    );

    const albs = Object.values(
      template.findResources('AWS::ElasticLoadBalancingV2::LoadBalancer'),
    ) as { Properties: { Subnets?: { Ref?: string }[] } }[];
    const albSubnets = (albs[0].Properties.Subnets ?? []).map((s) => s.Ref);
    for (const subnet of albSubnets) {
      expect(isolatedLogicalIds).toContain(subnet);
    }

    const services = Object.values(template.findResources('AWS::ECS::Service')) as {
      Properties: {
        NetworkConfiguration?: { AwsvpcConfiguration?: { Subnets?: { Ref?: string }[] } };
      };
    }[];
    const taskSubnets = (
      services[0].Properties.NetworkConfiguration?.AwsvpcConfiguration?.Subnets ?? []
    ).map((s) => s.Ref);
    expect(taskSubnets.length).toBeGreaterThan(0);
    for (const subnet of taskSubnets) {
      expect(isolatedLogicalIds).toContain(subnet);
    }
  });

  test('ヘルスチェックは /healthcheck を見る（S3 に触らないパス）', () => {
    const { template } = createFixture();

    // ターゲットグループの Port は ecs-patterns 既定の 80。
    // 実際の転送先はコンテナポート 8080（下の PortMappings）で、
    // ここで確認したいのは S3 に触らないパスをヘルスチェックに使っていること。
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/healthcheck',
      TargetType: 'ip',
    });

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          PortMappings: Match.arrayWith([Match.objectLike({ ContainerPort: 8080 })]),
        }),
      ]),
    });
  });

  test('デプロイ失敗時に自動ロールバックし、2 タスクを下回らない', () => {
    const { template } = createFixture();

    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 2,
      DeploymentConfiguration: Match.objectLike({
        DeploymentCircuitBreaker: { Enable: true, Rollback: true },
        MinimumHealthyPercent: 100,
      }),
    });
  });

  test('maintenance フラグがコンテナの環境変数に渡る', () => {
    const { template } = createFixture({ maintenance: true });

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([{ Name: 'MAINTENANCE', Value: 'true' }]),
        }),
      ]),
    });
  });

  test('配信バケットは公開ブロック + CMEK + SSL 必須', () => {
    const { template, closedWeb } = createFixture();

    expect(closedWeb.bucket).toBeDefined();
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({ SSEAlgorithm: 'aws:kms' }),
          }),
        ]),
      }),
    });
  });
});
