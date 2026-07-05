import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, test } from 'vitest';
import { ClosedNetworkStack } from '../../lib/closed-network-stack';
import { stackInputSchema } from '../../lib/stack-input';

const params = stackInputSchema.parse({
  closedNetworkDomainName: 'genai.example.internal',
  closedNetworkCertificateArn:
    'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
});

describe('ClosedNetworkStack', () => {
  test('TGW 後付け用に VPC / サブネット / ルートテーブルの ID をエクスポートする', () => {
    const app = new cdk.App();
    const stack = new ClosedNetworkStack(app, 'TestClosedNetworkStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
      params,
    });

    const outputs = Template.fromStack(stack).toJSON().Outputs ?? {};
    const exportNames = Object.values(outputs)
      .map((o) => (o as { Export?: { Name?: string } }).Export?.Name)
      .filter((n): n is string => Boolean(n));

    expect(exportNames).toContain('TestClosedNetworkStack-VpcId');
    // 2 AZ 分のサブネット ID とルートテーブル ID がエクスポートされること
    expect(exportNames.filter((n) => n.includes('-SubnetId-')).length).toBe(2);
    expect(exportNames.filter((n) => n.includes('-RouteTableId-')).length).toBe(2);
  });

  test('region と modelRegion が一致しない場合はエラーになる', () => {
    const app = new cdk.App();

    expect(
      () =>
        new ClosedNetworkStack(app, 'TestClosedNetworkStack', {
          env: { account: '123456789012', region: 'us-east-1' },
          params, // modelRegion はデフォルトの ap-northeast-1
        }),
    ).toThrow(/must match/);
  });
});
