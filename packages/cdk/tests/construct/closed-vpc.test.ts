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
    const endpoints = Object.values(
      template.findResources('AWS::EC2::VPCEndpoint'),
    ) as {
      Properties: { VpcEndpointType?: string; PrivateDnsEnabled?: boolean };
    }[];

    const interfaceEndpoints = endpoints.filter(
      (e) => e.Properties.VpcEndpointType === 'Interface',
    );
    const gatewayEndpoints = endpoints.filter(
      (e) => e.Properties.VpcEndpointType !== 'Interface',
    );

    // closed-vpc.ts の VPC_ENDPOINTS（17 サービス）。新しい AWS サービスを使う機能を追加した場合は
    // VPC_ENDPOINTS への追加とあわせてこの期待値を更新すること
    expect(interfaceEndpoints.length).toBe(17);
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
