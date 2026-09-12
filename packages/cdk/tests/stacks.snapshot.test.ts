import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BUNDLING_STACKS, DISABLE_ASSET_STAGING_CONTEXT } from 'aws-cdk-lib/cx-api';
import { describe, expect, test } from 'vitest';
import { createStacks } from '../lib/create-stacks';
import { type StackInput, stackInputSchema } from '../lib/stack-input';

// upstream 追従でテンプレートに何が変わったかを差分で確認するためのスナップショット。
// GenU（aws-samples/generative-ai-use-cases）が閉域モードで行っているのと同じ粒度で、
// スタック全体の CloudFormation テンプレートを固定する。
//
// 差分が出たら「意図した変更か」をレビューして `vitest -u` で更新すること。
// マージ後に想定外のリソースが増減していないかを見るのが目的。

const appContext = {
  [BUNDLING_STACKS]: [],
  [DISABLE_ASSET_STAGING_CONTEXT]: true,
};

const stackInput = {
  account: '123456789012',
  region: 'ap-northeast-1',
  env: '',
  appEnv: 'snapshot',
  closedNetworkVpcCidr: '10.1.0.0/16',
  closedNetworkDomainName: 'genai.example.internal',
  closedNetworkCertificateArn:
    'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
  closedNetworkAllowedClientCidrs: ['172.16.0.0/12'],
  guardrailEnabled: true,
};

// アセット（Lambda の zip / コンテナイメージ / ネストスタックのテンプレート）のハッシュは
// ソース変更のたびに変わり、スナップショットの本質的な差分を埋もれさせるため伏せる。
const HASH_PATTERNS: [RegExp, string][] = [
  [/\b[0-9a-f]{64}\.zip\b/g, 'HASH-REPLACED.zip'],
  [/\b[0-9a-f]{64}\.json\b/g, 'HASH-REPLACED.json'],
  [/(container-assets-[^:"]+:)[0-9a-f]{64}/g, '$1HASH-REPLACED'],
  [/\b[0-9a-f]{64}\b/g, 'HASH-REPLACED'],
];

const normalizeHashes = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return HASH_PATTERNS.reduce<string>(
      (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.map(normalizeHashes);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        // 論理 ID にもアセットハッシュが混ざることがある
        normalizeHashes(key) as string,
        normalizeHashes(v),
      ]),
    );
  }
  return value;
};

const buildTemplates = () => {
  const app = new cdk.App({ context: appContext });
  const params: StackInput = stackInputSchema.parse(stackInput);
  const { closedNetworkStack, generativeAiUseCasesStack, guardrail } = createStacks(app, params);

  return {
    closedNetwork: normalizeHashes(Template.fromStack(closedNetworkStack).toJSON()),
    generativeAiUseCases: normalizeHashes(Template.fromStack(generativeAiUseCasesStack).toJSON()),
    guardrail: normalizeHashes(Template.fromStack(guardrail!).toJSON()),
  };
};

describe('Stack templates (closed network)', () => {
  test('ClosedNetworkStack matches the snapshot', () => {
    expect(buildTemplates().closedNetwork).toMatchSnapshot();
  });

  test('GenerativeAiUseCasesStack matches the snapshot', () => {
    expect(buildTemplates().generativeAiUseCases).toMatchSnapshot();
  });

  test('GuardrailStack matches the snapshot', () => {
    expect(buildTemplates().guardrail).toMatchSnapshot();
  });

  test('スナップショットは実行のたびに安定している（ハッシュ正規化が効いている）', () => {
    // 2 回組み立てて一致することを確認しておく。
    // ここが落ちる場合はスナップショットが毎回差分を出す状態になっている。
    expect(JSON.stringify(buildTemplates())).toBe(JSON.stringify(buildTemplates()));
  });
});
