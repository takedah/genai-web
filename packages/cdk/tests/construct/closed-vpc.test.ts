import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, test } from 'vitest';
import { ClosedVpc } from '../../lib/construct/closedNetwork';

describe('ClosedVpc Construct', () => {
  test('hostedZoneId 未指定の場合は PrivateHostedZone を新規作成する', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    const closedVpc = new ClosedVpc(stack, 'ClosedVpc', {
      ipv4Cidr: '10.1.0.0/16',
      domainName: 'genai.example.internal',
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Route53::HostedZone', 1);
    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: 'genai.example.internal.',
    });
    expect(closedVpc.hostedZone).toBeDefined();
    expect(closedVpc.hostedZone!.zoneName).toBe('genai.example.internal');
  });

  test('hostedZoneId 指定の場合は既存ゾーンを取り込み、新規ゾーンは作成しない', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    const closedVpc = new ClosedVpc(stack, 'ClosedVpc', {
      ipv4Cidr: '10.1.0.0/16',
      domainName: 'genai.example.internal',
      hostedZoneId: 'Z0123456789ABCDEFGHIJ',
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Route53::HostedZone', 0);
    // 既存ゾーンが hostedZone として公開され、HTTPS リスナーや A レコード作成に使えること
    expect(closedVpc.hostedZone).toBeDefined();
    expect(closedVpc.hostedZone!.hostedZoneId).toBe('Z0123456789ABCDEFGHIJ');
    expect(closedVpc.hostedZone!.zoneName).toBe('genai.example.internal');
  });

  test('閉域用の VPC エンドポイント一式とフローログが作成される', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new ClosedVpc(stack, 'ClosedVpc', {
      ipv4Cidr: '10.1.0.0/16',
    });

    const template = Template.fromStack(stack);
    const endpoints = Object.values(template.findResources('AWS::EC2::VPCEndpoint')) as {
      Properties: { VpcEndpointType?: string; PrivateDnsEnabled?: boolean };
    }[];

    const interfaceEndpoints = endpoints.filter(
      (e) => e.Properties.VpcEndpointType === 'Interface',
    );
    const gatewayEndpoints = endpoints.filter((e) => e.Properties.VpcEndpointType !== 'Interface');

    // closed-vpc.ts の VPC_ENDPOINTS（16 サービス）。新しい AWS サービスを使う機能を追加した場合は
    // VPC_ENDPOINTS への追加とあわせてこの期待値を更新すること
    expect(interfaceEndpoints.length).toBe(16);
    // S3 + DynamoDB の Gateway 型
    expect(gatewayEndpoints.length).toBe(2);

    // 全 Interface 型エンドポイントで Private DNS が有効であること
    // （アプリが通常のサービスエンドポイント名のまま閉域経路を使うための前提）
    for (const endpoint of interfaceEndpoints) {
      expect(endpoint.Properties.PrivateDnsEnabled).toBe(true);
    }

    // 閉域の疎通調査用にフローログが有効であること
    template.resourceCountIs('AWS::EC2::FlowLog', 1);
  });

  test('allowedClientCidrs がエンドポイント共通 SG の許可対象に追加される', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new ClosedVpc(stack, 'ClosedVpc', {
      ipv4Cidr: '10.1.0.0/16',
      allowedClientCidrs: ['172.16.0.0/12', '192.168.10.0/24'],
    });

    const template = Template.fromStack(stack);
    const securityGroups = Object.values(template.findResources('AWS::EC2::SecurityGroup')) as {
      Properties: {
        SecurityGroupIngress?: { CidrIp?: unknown; FromPort?: number; ToPort?: number }[];
      };
    }[];

    // エンドポイント共通 SG（VPC CIDR + クライアント CIDR ×2 の計 3 ルールを持つ SG）を特定
    const endpointSg = securityGroups.find(
      (sg) => (sg.Properties.SecurityGroupIngress ?? []).length === 3,
    );
    expect(endpointSg).toBeDefined();

    const cidrs = (endpointSg!.Properties.SecurityGroupIngress ?? []).map((r) => r.CidrIp);
    // オンプレミス端末側 CIDR が 443 で許可されていること
    expect(cidrs).toContain('172.16.0.0/12');
    expect(cidrs).toContain('192.168.10.0/24');
    for (const rule of endpointSg!.Properties.SecurityGroupIngress ?? []) {
      expect(rule.FromPort).toBe(443);
      expect(rule.ToPort).toBe(443);
    }
  });

  test('Lambda が使う AWS サービスのエンドポイントが揃っている', () => {
    // エンドポイントが無いサービスを Lambda が呼ぶと、エラーにならず接続待ちで固まり
    // Lambda のタイムアウトまで到達する（原因が非常に分かりにくい）。
    // 2026-09-13 に monitoring（CloudWatch メトリクス）の取りこぼしで実際に発生した。
    // lambda 配下の @aws-sdk/client-* に対応するサービスをここで押さえる。
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new ClosedVpc(stack, 'ClosedVpc', { ipv4Cidr: '10.1.0.0/16' });

    const template = Template.fromStack(stack);
    const serviceNames = Object.values(template.findResources('AWS::EC2::VPCEndpoint')).map((e) =>
      JSON.stringify((e as { Properties: { ServiceName?: unknown } }).Properties.ServiceName),
    );
    const hasService = (suffix: string) =>
      serviceNames.some((n) => n.includes(`.${suffix}"`) || n.includes(`.${suffix}\\`));

    // client-cloudwatch（PutMetricData）。logs とは別サービスである点に注意
    expect(hasService('monitoring')).toBe(true);
    // client-cloudwatch-logs
    expect(hasService('logs')).toBe(true);
    // その他、lambda 配下で使用している SDK クライアントに対応するもの
    for (const svc of [
      'bedrock-runtime',
      'cognito-identity',
      'cognito-idp',
      'kms',
      'secretsmanager',
      'sqs',
      'sts',
      'transcribe',
      'email',
    ]) {
      expect({ service: svc, present: hasService(svc) }).toEqual({ service: svc, present: true });
    }
  });

  test('SageMaker のエンドポイントは endpointNames を使う場合のみ作成される', () => {
    // 使わない環境で常時作ると無駄な課金になるため条件付き。
    // ただし作り忘れると monitoring と同じ「固まる」不具合になるため、両方向を押さえる。
    const withoutApp = new cdk.App();
    const withoutStack = new cdk.Stack(withoutApp, 'WithoutStack');
    new ClosedVpc(withoutStack, 'ClosedVpc', { ipv4Cidr: '10.1.0.0/16' });
    const withoutNames = Object.values(
      Template.fromStack(withoutStack).findResources('AWS::EC2::VPCEndpoint'),
    ).map((e) => JSON.stringify((e as { Properties: { ServiceName?: unknown } }).Properties.ServiceName));
    expect(withoutNames.some((n) => n.includes('sagemaker.runtime'))).toBe(false);

    const withApp = new cdk.App();
    const withStack = new cdk.Stack(withApp, 'WithStack');
    new ClosedVpc(withStack, 'ClosedVpc', {
      ipv4Cidr: '10.1.0.0/16',
      sagemakerRuntimeRequired: true,
    });
    const withNames = Object.values(
      Template.fromStack(withStack).findResources('AWS::EC2::VPCEndpoint'),
    ).map((e) => JSON.stringify((e as { Properties: { ServiceName?: unknown } }).Properties.ServiceName));
    expect(withNames.some((n) => n.includes('sagemaker.runtime'))).toBe(true);
  });

  test('domainName 未指定の場合は hostedZone を作成しない', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    const closedVpc = new ClosedVpc(stack, 'ClosedVpc', {
      ipv4Cidr: '10.1.0.0/16',
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Route53::HostedZone', 0);
    expect(closedVpc.hostedZone).toBeUndefined();
  });
});
