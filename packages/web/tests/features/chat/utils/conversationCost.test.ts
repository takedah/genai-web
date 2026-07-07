import type { ShownMessage, UsageCostEntry } from 'genai-web';
import { describe, expect, it } from 'vitest';
import { aggregateConversationCost } from '../../../../src/features/chat/utils/conversationCost';

const entry = (
  overrides: Partial<UsageCostEntry> & {
    inputTokens?: number;
    outputTokens?: number;
  },
): UsageCostEntry => ({
  usage: {
    model: 'jp.anthropic.claude-opus-4-8',
    inputTokens: overrides.inputTokens ?? 100,
    outputTokens: overrides.outputTokens ?? 20,
    totalTokens: (overrides.inputTokens ?? 100) + (overrides.outputTokens ?? 20),
  },
  ...(overrides.estimatedCost !== undefined ? { estimatedCost: overrides.estimatedCost } : {}),
});

const usdEntry = (input: number, output: number, totalCost: number): UsageCostEntry =>
  entry({
    inputTokens: input,
    outputTokens: output,
    estimatedCost: { totalCost, currency: 'USD' },
  });

const usdJpyEntry = (input: number, output: number, usd: number, jpy: number): UsageCostEntry =>
  entry({
    inputTokens: input,
    outputTokens: output,
    estimatedCost: {
      totalCost: usd,
      currency: 'USD',
      converted: { totalCost: jpy, currency: 'JPY', rate: 150, fromCurrency: 'USD' },
    },
  });

describe('aggregateConversationCost', () => {
  const assistant = (entries?: UsageCostEntry[]): ShownMessage => ({
    role: 'assistant',
    content: 'answer',
    ...(entries !== undefined ? { usageCostHistory: entries } : {}),
  });
  const user = (): ShownMessage => ({ role: 'user', content: 'question' });

  it('usage を持つ assistant が無ければ undefined', () => {
    expect(aggregateConversationCost([user(), assistant()])).toBeUndefined();
  });

  it('user メッセージを無視し assistant のトークンとコストを合算する', () => {
    const result = aggregateConversationCost([
      user(),
      assistant([usdEntry(100, 20, 0.01)]),
      user(),
      assistant([usdEntry(50, 10, 0.02)]),
    ]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.outputTokens).toBe(30);
    expect(result?.cost?.totalCost).toBeCloseTo(0.03);
    expect(result?.cost?.currency).toBe('USD');
  });

  it('estimatedCost が無いメッセージのトークンも合算しコストは持つ分だけ', () => {
    const result = aggregateConversationCost([
      assistant([usdEntry(100, 20, 0.01)]),
      assistant([entry({ inputTokens: 50, outputTokens: 10 })]),
    ]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.outputTokens).toBe(30);
    expect(result?.cost?.totalCost).toBeCloseTo(0.01);
  });

  it('converted を全 assistant が持つ場合のみ convertedCost を合算する', () => {
    const result = aggregateConversationCost([
      assistant([usdJpyEntry(100, 20, 0.01, 1.5)]),
      assistant([usdJpyEntry(50, 10, 0.02, 3.0)]),
    ]);
    expect(result?.convertedCost?.totalCost).toBeCloseTo(4.5);
  });

  it('converted が一部欠ける場合 convertedCost は付与しない', () => {
    const result = aggregateConversationCost([
      assistant([usdJpyEntry(100, 20, 0.01, 1.5)]),
      assistant([usdEntry(50, 10, 0.02)]),
    ]);
    expect(result?.cost?.totalCost).toBeCloseTo(0.03);
    expect(result?.convertedCost).toBeUndefined();
  });

  it('コストの無いメッセージが混ざっても converted 対象が揃えば convertedCost を合算する', () => {
    const result = aggregateConversationCost([
      assistant([usdJpyEntry(100, 20, 0.01, 1.5)]),
      assistant([entry({ inputTokens: 50, outputTokens: 10 })]),
    ]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.cost?.totalCost).toBeCloseTo(0.01);
    expect(result?.convertedCost?.totalCost).toBeCloseTo(1.5);
  });
});
