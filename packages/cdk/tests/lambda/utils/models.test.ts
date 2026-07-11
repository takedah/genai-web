import type { ConverseStreamOutput } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import { extractConverseStreamUsage } from '../../../lambda/utils/models';

const wrapMetadataUsage = (
  usage: NonNullable<NonNullable<ConverseStreamOutput['metadata']>['usage']>,
): ConverseStreamOutput =>
  ({
    metadata: { usage },
  }) as ConverseStreamOutput;

describe('extractConverseStreamUsage', () => {
  it('metadata が無いイベント（contentBlockDelta など）では undefined を返す', () => {
    const out = { contentBlockDelta: { delta: { text: 'hi' } } } as ConverseStreamOutput;
    expect(extractConverseStreamUsage(out)).toBeUndefined();
  });

  it('metadata.usage から RawTokenUsage と集約 totals を抽出する', () => {
    const out = wrapMetadataUsage({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    const result = extractConverseStreamUsage(out);
    expect(result).toEqual({
      raw: { inputTokens: 100, outputTokens: 50 },
      totals: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
  });

  it('cacheRead / cacheWrite を ChatUsage 用名にリネームし、集約 input にも含める', () => {
    const out = wrapMetadataUsage({
      inputTokens: 80,
      outputTokens: 40,
      totalTokens: 200,
      cacheReadInputTokens: 60,
      cacheWriteInputTokens: 20,
    });
    const result = extractConverseStreamUsage(out);
    expect(result?.raw).toEqual({
      inputTokens: 80,
      outputTokens: 40,
      cacheReadInputTokens: 60,
      cacheWriteInputTokens: 20,
    });
    expect(result?.totals).toEqual({
      inputTokens: 160,
      outputTokens: 40,
      totalTokens: 200,
      cacheReadTokens: 60,
      cacheWriteTokens: 20,
    });
  });

  it('cacheRead / cacheWrite が 0 のときは totals に含めない（ChatUsage の optional 扱い）', () => {
    const out = wrapMetadataUsage({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    });
    const result = extractConverseStreamUsage(out);
    expect(result?.totals.cacheReadTokens).toBeUndefined();
    expect(result?.totals.cacheWriteTokens).toBeUndefined();
    // raw は SDK 由来なので 0 でも保持する
    expect(result?.raw.cacheReadInputTokens).toBe(0);
    expect(result?.raw.cacheWriteInputTokens).toBe(0);
  });

  it('SDK が totalTokens を返さない場合は input(集約) + output で補完する', () => {
    const out = wrapMetadataUsage({
      inputTokens: 80,
      outputTokens: 40,
      cacheReadInputTokens: 20,
    } as never);
    const result = extractConverseStreamUsage(out);
    expect(result?.totals.totalTokens).toBe(140);
  });
});
