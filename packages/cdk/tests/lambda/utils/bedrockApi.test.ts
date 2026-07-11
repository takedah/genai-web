import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import bedrockApi from '../../../lambda/utils/bedrockApi';
import { mockEnvironment } from '../testUtils';

const bedrockMock = mockClient(BedrockRuntimeClient);

describe('bedrockApi', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    bedrockMock.reset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
    }
    vi.restoreAllMocks();
  });

  describe('BedrockRuntimeClient singleton behavior', () => {
    test('複数回呼び出しても正常に動作する（singletonによる接続再利用）', async () => {
      restoreEnv = mockEnvironment({
        MODEL_REGION: 'us-east-1',
      });

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Test response' }],
          },
        },
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      // 複数回呼び出しても正常に動作することを確認
      const result1 = await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Hello' }],
        'test-id-1',
      );

      const result2 = await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Hello again' }],
        'test-id-2',
      );

      // 両方のリクエストが成功することを確認
      expect(result1).toBe('Test response');
      expect(result2).toBe('Test response');

      // 2回のAPI呼び出しが行われたことを確認
      expect(bedrockMock.calls()).toHaveLength(2);
    });

    test('通常の認証情報でBedrockRuntimeClientが正常に動作する', async () => {
      restoreEnv = mockEnvironment({
        MODEL_REGION: 'ap-northeast-1',
      });

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Test response' }],
          },
        },
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      const result = await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Hello' }],
        'test-id',
      );

      expect(result).toBe('Test response');
      expect(bedrockMock.calls()).toHaveLength(1);
    });
  });

  describe('CredentialsProvider with AssumeRole', () => {
    test('CROSS_ACCOUNT_BEDROCK_ROLE_ARNが設定されている場合も正常に動作する', async () => {
      restoreEnv = mockEnvironment({
        MODEL_REGION: 'us-west-2',
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: 'arn:aws:iam::123456789012:role/BedrockAccessRole',
      });

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Cross-account response' }],
          },
        },
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      const result = await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Cross-account test' }],
        'test-id',
      );

      expect(result).toBe('Cross-account response');
      expect(bedrockMock.calls()).toHaveLength(1);
    });

    test('CROSS_ACCOUNT_BEDROCK_ROLE_ARNが設定されている場合も複数回呼び出しで正常に動作する', async () => {
      restoreEnv = mockEnvironment({
        MODEL_REGION: 'eu-west-1',
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: 'arn:aws:iam::987654321098:role/BedrockRole',
      });

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Response' }],
          },
        },
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      // 3回連続呼び出し
      await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Test 1' }],
        'test-id-1',
      );
      await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Test 2' }],
        'test-id-2',
      );
      await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Test 3' }],
        'test-id-3',
      );

      // 3回のAPI呼び出しが行われたことを確認
      expect(bedrockMock.calls()).toHaveLength(3);
    });
  });

  describe('inference profile ARN mapping', () => {
    test('INFERENCE_PROFILE_MAPが設定されている場合、モデルIDをInference Profile ARNにマッピングする', async () => {
      const profileMap = {
        'anthropic.claude-3-sonnet-20240229-v1:0':
          'arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-3-sonnet-20240229-v1:0',
      };

      restoreEnv = mockEnvironment({
        MODEL_REGION: 'us-east-1',
        INFERENCE_PROFILE_MAP: JSON.stringify(profileMap),
      });

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Inference profile response' }],
          },
        },
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      const result = await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Test' }],
        'test-id',
      );

      expect(result).toBe('Inference profile response');

      // ConverseCommandの呼び出し引数を確認
      const calls = bedrockMock.calls();
      expect(calls).toHaveLength(1);
      const commandInput = calls[0].args[0].input;
      expect(commandInput.modelId).toBe(
        'arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-3-sonnet-20240229-v1:0',
      );
    });

    test('INFERENCE_PROFILE_MAPが不正なJSONの場合、元のモデルIDを使用する', async () => {
      restoreEnv = mockEnvironment({
        MODEL_REGION: 'us-east-1',
        INFERENCE_PROFILE_MAP: 'invalid-json',
      });

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Fallback response' }],
          },
        },
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      const result = await bedrockApi.invoke(
        { type: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
        [{ role: 'user', content: 'Test' }],
        'test-id',
      );

      expect(result).toBe('Fallback response');

      // console.warnが呼ばれたことを確認
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to parse INFERENCE_PROFILE_MAP, using original model ID',
      );

      // 元のモデルIDが使用されていることを確認
      const calls = bedrockMock.calls();
      expect(calls).toHaveLength(1);
      const commandInput = calls[0].args[0].input;
      expect(commandInput.modelId).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
    });
  });

  describe('invokeStream usage / metadata 返却', () => {
    const collectChunks = async (
      gen: AsyncGenerator<string, void, unknown>,
    ): Promise<unknown[]> => {
      const chunks: unknown[] = [];
      for await (const c of gen) {
        // streamingChunk は JSONL（末尾に改行）を返すため、改行を取り除いてからパース
        chunks.push(JSON.parse(c.replace(/\n$/, '')));
      }
      return chunks;
    };

    const buildStream = (events: unknown[]) => ({
      stream: (async function* () {
        for (const e of events) {
          yield e;
        }
      })(),
    });

    test('messageStop の後に届く metadata イベントから usage を抽出して metadata 付き chunk を返す', async () => {
      restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1' });
      bedrockMock.on(ConverseStreamCommand).resolves(
        buildStream([
          { contentBlockDelta: { delta: { text: 'hi' } } },
          { messageStop: { stopReason: 'end_turn' } },
          {
            metadata: {
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          },
        ]),
      );

      const chunks = await collectChunks(
        bedrockApi.invokeStream(
          { type: 'bedrock', modelId: 'jp.anthropic.claude-sonnet-4-6' },
          [{ role: 'user', content: 'hi' }],
          'req-1',
        ),
      );

      // 1) text, 2) stopReason, 3) metadata の順に届く（messageStop の後で break しないことの検証）
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toMatchObject({ text: 'hi' });
      expect(chunks[1]).toMatchObject({ stopReason: 'end_turn' });
      expect(chunks[2]).toMatchObject({
        text: '',
        metadata: {
          usage: {
            model: 'jp.anthropic.claude-sonnet-4-6',
            provider: 'bedrock',
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        },
      });
    });

    test('cacheRead/cacheWrite を含む usage では集約 input と cache フィールドを ChatUsage 形式で返す', async () => {
      restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1' });
      bedrockMock.on(ConverseStreamCommand).resolves(
        buildStream([
          { messageStop: { stopReason: 'end_turn' } },
          {
            metadata: {
              usage: {
                inputTokens: 80,
                outputTokens: 40,
                totalTokens: 200,
                cacheReadInputTokens: 60,
                cacheWriteInputTokens: 20,
              },
            },
          },
        ]),
      );

      const chunks = await collectChunks(
        bedrockApi.invokeStream(
          { type: 'bedrock', modelId: 'jp.anthropic.claude-sonnet-4-6' },
          [{ role: 'user', content: 'hi' }],
          'req-cache',
        ),
      );

      const metaChunk = chunks.find(
        (c): c is { metadata: { usage: Record<string, number | string> } } =>
          typeof c === 'object' && c !== null && 'metadata' in (c as object),
      );
      expect(metaChunk?.metadata.usage).toMatchObject({
        inputTokens: 160,
        outputTokens: 40,
        totalTokens: 200,
        cacheReadTokens: 60,
        cacheWriteTokens: 20,
      });
    });

    test('pricing 定義済みモデルでは metadata.estimatedCost が付与される', async () => {
      restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1' });
      bedrockMock.on(ConverseStreamCommand).resolves(
        buildStream([
          { messageStop: { stopReason: 'end_turn' } },
          {
            metadata: {
              usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
            },
          },
        ]),
      );

      const chunks = await collectChunks(
        bedrockApi.invokeStream(
          { type: 'bedrock', modelId: 'jp.anthropic.claude-sonnet-4-6' },
          [{ role: 'user', content: 'hi' }],
          'req-cost',
        ),
      );

      const meta = chunks.find(
        (c): c is { metadata: { estimatedCost?: { totalCost: number; currency: string } } } =>
          typeof c === 'object' && c !== null && 'metadata' in (c as object),
      );
      expect(meta?.metadata.estimatedCost).toBeDefined();
      expect(meta?.metadata.estimatedCost?.currency).toBe('USD');
      // 1000 × 3.30/1M = 0.0033, 500 × 16.50/1M = 0.00825 → 0.01155
      expect(meta?.metadata.estimatedCost?.totalCost).toBeCloseTo(0.01155, 8);
    });

    test('pricing 未定義モデルでは usage のみで estimatedCost なし（フェイルセーフ）', async () => {
      restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1' });
      bedrockMock.on(ConverseStreamCommand).resolves(
        buildStream([
          { messageStop: { stopReason: 'end_turn' } },
          {
            metadata: {
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            },
          },
        ]),
      );

      const chunks = await collectChunks(
        bedrockApi.invokeStream(
          // BEDROCK_TEXT_GEN_MODELS には登録済みだが modelPricing.json には未掲載のモデル
          { type: 'bedrock', modelId: 'apac.amazon.nova-pro-v1:0' },
          [{ role: 'user', content: 'hi' }],
          'req-no-pricing',
        ),
      );

      const meta = chunks.find(
        (c): c is { metadata: { usage: object; estimatedCost?: object } } =>
          typeof c === 'object' && c !== null && 'metadata' in (c as object),
      );
      expect(meta?.metadata.usage).toBeDefined();
      expect(meta?.metadata.estimatedCost).toBeUndefined();
    });

    test('metadata イベントが届かなければ metadata 付き chunk は出ない（フェイルセーフ）', async () => {
      restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1' });
      bedrockMock.on(ConverseStreamCommand).resolves(
        buildStream([
          { contentBlockDelta: { delta: { text: 'ok' } } },
          { messageStop: { stopReason: 'end_turn' } },
        ]),
      );

      const chunks = await collectChunks(
        bedrockApi.invokeStream(
          { type: 'bedrock', modelId: 'jp.anthropic.claude-sonnet-4-6' },
          [{ role: 'user', content: 'hi' }],
          'req-no-meta',
        ),
      );

      expect(chunks.some((c) => 'metadata' in (c as object))).toBe(false);
      // text と stopReason は従来どおり届く（既存動作の回帰なし）
      expect(chunks[0]).toMatchObject({ text: 'ok' });
      expect(chunks[1]).toMatchObject({ stopReason: 'end_turn' });
    });
  });
});
