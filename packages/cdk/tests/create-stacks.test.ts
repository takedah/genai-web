import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BUNDLING_STACKS, DISABLE_ASSET_STAGING_CONTEXT } from 'aws-cdk-lib/cx-api';
import { describe, expect, test } from 'vitest';
import { createStacks } from '../lib/create-stacks';
import { type StackInput, stackInputSchema } from '../lib/stack-input';

// Lambda のバンドルと Docker アセットのステージングはテストでは不要なので止める
// （テンプレートの構造だけを見る）
const appContext = {
  [BUNDLING_STACKS]: [],
  [DISABLE_ASSET_STAGING_CONTEXT]: true,
};

const baseInput = {
  account: '123456789012',
  region: 'ap-northeast-1',
  env: '',
  appEnv: 'test',
  closedNetworkDomainName: 'genai.example.internal',
  closedNetworkCertificateArn:
    'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
};

const buildStacks = (overrides: Record<string, unknown> = {}) => {
  const app = new cdk.App({ context: appContext });
  const params: StackInput = stackInputSchema.parse({ ...baseInput, ...overrides });
  return createStacks(app, params);
};

// construct 単位のテストでは拾えない「組み合わせて synth すると壊れる」を検知するための
// スモークテスト。upstream 追従で construct 間の受け渡しが変わったときに気づけるようにする。
describe('createStacks (synth smoke test)', () => {
  test('既定のパラメータで全スタックが synth できる', () => {
    const { closedNetworkStack, generativeAiUseCasesStack, guardrail } = buildStacks();

    expect(() => Template.fromStack(closedNetworkStack)).not.toThrow();
    expect(() => Template.fromStack(generativeAiUseCasesStack)).not.toThrow();
    // guardrailEnabled のデフォルトは false
    expect(guardrail).toBeNull();
  });

  test('guardrailEnabled でガードレールスタックも synth できる', () => {
    const { guardrail } = buildStacks({ guardrailEnabled: true });

    expect(guardrail).not.toBeNull();
    expect(() => Template.fromStack(guardrail!)).not.toThrow();
  });

  test('既存の Private Hosted Zone を指定してもスタック全体が synth できる', () => {
    const { closedNetworkStack, generativeAiUseCasesStack } = buildStacks({
      closedNetworkPrivateHostedZoneId: 'Z0123456789ABCDEFGHIJ',
    });

    const closedNetworkTemplate = Template.fromStack(closedNetworkStack);
    // ゾーンは新規作成されない
    closedNetworkTemplate.resourceCountIs('AWS::Route53::HostedZone', 0);

    // ALB の A レコードは指定した既存ゾーンに作られる
    Template.fromStack(generativeAiUseCasesStack).hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'A',
      Name: 'genai.example.internal.',
      HostedZoneId: 'Z0123456789ABCDEFGHIJ',
    });
  });

  test('env サフィックスがスタック名に反映される', () => {
    const { closedNetworkStack, generativeAiUseCasesStack } = buildStacks({
      env: '-selfHostingDev',
    });

    expect(closedNetworkStack.stackName).toBe('ClosedNetworkStack-selfHostingDev');
    expect(generativeAiUseCasesStack.stackName).toBe('GenerativeAiUseCasesStack-selfHostingDev');
  });

  test('アプリスタックは閉域ネットワークスタックに依存する', () => {
    const { closedNetworkStack, generativeAiUseCasesStack } = buildStacks();

    // 依存が外れると VPC 未作成のままアプリスタックがデプロイされうる
    expect(generativeAiUseCasesStack.dependencies).toContain(closedNetworkStack);
  });

  test('閉域方針どおり、インターネット向けリソースが生成されない', () => {
    const { closedNetworkStack, generativeAiUseCasesStack } = buildStacks();

    for (const stack of [closedNetworkStack, generativeAiUseCasesStack]) {
      const template = Template.fromStack(stack);
      // CloudFront / WAF / インターネットゲートウェイ / NAT は閉域構成では使わない
      template.resourceCountIs('AWS::CloudFront::Distribution', 0);
      template.resourceCountIs('AWS::WAFv2::WebACL', 0);
      template.resourceCountIs('AWS::EC2::InternetGateway', 0);
      template.resourceCountIs('AWS::EC2::NatGateway', 0);
    }
  });

  test('全 Lambda が VPC 内（PRIVATE_ISOLATED 相当）に配置される', () => {
    const { generativeAiUseCasesStack } = buildStacks();

    const template = Template.fromStack(generativeAiUseCasesStack);
    const functions = Object.entries(template.findResources('AWS::Lambda::Function')) as [
      string,
      { Properties: { VpcConfig?: unknown } },
    ][];

    // CDK / サードパーティ構成が内部で作る関数（カスタムリソースのハンドラ等）は対象外
    const appFunctions = functions.filter(
      ([logicalId]) => !/CustomResource|Custom::|LogRetention|NodejsBuild/i.test(logicalId),
    );

    // 除外パターンが効きすぎてテストが骨抜きにならないよう、検査対象数の下限を置く
    expect(appFunctions.length).toBeGreaterThan(15);

    const withoutVpc = appFunctions
      .filter(([, fn]) => fn.Properties.VpcConfig === undefined)
      .map(([logicalId]) => logicalId);

    expect(withoutVpc).toEqual([]);
  });
});
