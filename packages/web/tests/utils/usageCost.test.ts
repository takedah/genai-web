import type { UsageCostEntry } from 'genai-web';
import { describe, expect, it } from 'vitest';
import {
  aggregateUsageCostEntries,
  formatDisplayCost,
  formatTokens,
} from '../../src/utils/usageCost';

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

describe('aggregateUsageCostEntries', () => {
  it('空配列 / undefined では undefined を返す', () => {
    expect(aggregateUsageCostEntries(undefined)).toBeUndefined();
    expect(aggregateUsageCostEntries([])).toBeUndefined();
  });

  it('単一エントリのトークンとコストを返す', () => {
    const result = aggregateUsageCostEntries([usdEntry(100, 20, 0.01)]);
    expect(result?.inputTokens).toBe(100);
    expect(result?.outputTokens).toBe(20);
    expect(result?.cost).toEqual({ totalCost: 0.01, currency: 'USD' });
    expect(result?.convertedCost).toBeUndefined();
  });

  it('複数エントリのトークンとコストを合算する', () => {
    const result = aggregateUsageCostEntries([usdEntry(100, 20, 0.01), usdEntry(50, 10, 0.02)]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.outputTokens).toBe(30);
    expect(result?.cost?.totalCost).toBeCloseTo(0.03);
    expect(result?.cost?.currency).toBe('USD');
  });

  it('estimatedCost を持つエントリが無ければトークンのみ返す', () => {
    const result = aggregateUsageCostEntries([entry({ inputTokens: 100, outputTokens: 20 })]);
    expect(result?.inputTokens).toBe(100);
    expect(result?.outputTokens).toBe(20);
    expect(result?.cost).toBeUndefined();
    expect(result?.convertedCost).toBeUndefined();
  });

  it('一部のみ estimatedCost を持つ場合、トークンは全エントリ、コストは持つ分だけ合算', () => {
    const result = aggregateUsageCostEntries([
      usdEntry(100, 20, 0.01),
      entry({ inputTokens: 50, outputTokens: 10 }),
    ]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.outputTokens).toBe(30);
    expect(result?.cost?.totalCost).toBeCloseTo(0.01);
  });

  it('currency 不一致では cost を省略しトークンは合算する', () => {
    const result = aggregateUsageCostEntries([
      usdEntry(100, 20, 0.01),
      entry({
        inputTokens: 50,
        outputTokens: 10,
        estimatedCost: { totalCost: 1, currency: 'EUR' },
      }),
    ]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.cost).toBeUndefined();
  });

  it('converted を全エントリが持つ場合のみ convertedCost を合算する', () => {
    const result = aggregateUsageCostEntries([
      usdJpyEntry(100, 20, 0.01, 1.5),
      usdJpyEntry(50, 10, 0.02, 3.0),
    ]);
    expect(result?.cost?.totalCost).toBeCloseTo(0.03);
    expect(result?.convertedCost?.totalCost).toBeCloseTo(4.5);
    expect(result?.convertedCost?.currency).toBe('JPY');
  });

  it('一部のみ converted を持つ場合、convertedCost は付与しない', () => {
    const result = aggregateUsageCostEntries([
      usdJpyEntry(100, 20, 0.01, 1.5),
      usdEntry(50, 10, 0.02),
    ]);
    expect(result?.cost?.totalCost).toBeCloseTo(0.03);
    expect(result?.convertedCost).toBeUndefined();
  });

  it('estimatedCost が無いエントリが混ざっても converted 対象が揃えば convertedCost を合算する', () => {
    const result = aggregateUsageCostEntries([
      usdJpyEntry(100, 20, 0.01, 1.5),
      entry({ inputTokens: 50, outputTokens: 10 }),
    ]);
    expect(result?.inputTokens).toBe(150);
    expect(result?.cost?.totalCost).toBeCloseTo(0.01);
    expect(result?.convertedCost?.totalCost).toBeCloseTo(1.5);
    expect(result?.convertedCost?.currency).toBe('JPY');
  });
});

describe('formatDisplayCost', () => {
  it('converted（円）を優先して表示する', () => {
    const result = formatDisplayCost({
      cost: { totalCost: 0.02, currency: 'USD' },
      convertedCost: { totalCost: 3.14, currency: 'JPY' },
    });
    expect(result).toBe('3.1円');
  });

  it('converted が無ければ生通貨を通貨コード後置で表示する', () => {
    const result = formatDisplayCost({
      cost: { totalCost: 0.0123, currency: 'USD' },
    });
    expect(result).toBe('0.0123 USD');
  });

  it('cost も convertedCost も無ければ undefined', () => {
    expect(formatDisplayCost({})).toBeUndefined();
    expect(formatDisplayCost(undefined)).toBeUndefined();
  });
});

describe('formatTokens', () => {
  it('桁区切りで整形する', () => {
    expect(formatTokens(699290)).toBe('699,290');
    expect(formatTokens(0)).toBe('0');
  });
});
