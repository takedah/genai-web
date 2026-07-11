import type { EstimatedCostSummary, UsageMetadata } from 'genai-web';
import { describe, expect, it } from 'vitest';
import { aggregateExAppUsageCost } from '../../../../src/features/exapp/utils/aggregateExAppUsageCost';

const metadata = (prompt: number, candidates: number): UsageMetadata => ({
  modelVersion: 'gemini-x',
  requestCount: 1,
  tokens: {
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    totalTokenCount: prompt + candidates,
  },
});

const usd = (totalCost: number): EstimatedCostSummary => ({ totalCost, currency: 'USD' });

const usdJpy = (usdCost: number, jpyCost: number): EstimatedCostSummary => ({
  totalCost: usdCost,
  currency: 'USD',
  converted: { totalCost: jpyCost, currency: 'JPY', rate: 150, fromCurrency: 'USD' },
});

describe('aggregateExAppUsageCost', () => {
  it('usageMetadata も totalEstimatedCost も無ければ undefined', () => {
    expect(aggregateExAppUsageCost(undefined, undefined)).toBeUndefined();
    expect(aggregateExAppUsageCost([], undefined)).toBeUndefined();
  });

  it('usageMetadata のトークンを合算する', () => {
    const result = aggregateExAppUsageCost([metadata(100, 20), metadata(50, 10)], usd(0.03));
    expect(result?.inputTokens).toBe(150);
    expect(result?.outputTokens).toBe(30);
    expect(result?.hasTokens).toBe(true);
    expect(result?.cost).toEqual({ totalCost: 0.03, currency: 'USD' });
  });

  it('totalEstimatedCost をそのまま cost にマッピングし再合算しない', () => {
    const result = aggregateExAppUsageCost([metadata(100, 20)], usd(0.99));
    expect(result?.cost).toEqual({ totalCost: 0.99, currency: 'USD' });
  });

  it('converted があれば convertedCost にマッピングする', () => {
    const result = aggregateExAppUsageCost([metadata(100, 20)], usdJpy(0.02, 3.0));
    expect(result?.cost).toEqual({ totalCost: 0.02, currency: 'USD' });
    expect(result?.convertedCost).toEqual({ totalCost: 3.0, currency: 'JPY' });
  });

  it('usageMetadata のみ（コスト無し）はトークンのみ返す', () => {
    const result = aggregateExAppUsageCost([metadata(100, 20)], undefined);
    expect(result?.inputTokens).toBe(100);
    expect(result?.hasTokens).toBe(true);
    expect(result?.cost).toBeUndefined();
  });

  it('totalEstimatedCost のみ（usageMetadata 無し）は hasTokens=false でコストのみ返す', () => {
    const result = aggregateExAppUsageCost(undefined, usd(0.5));
    expect(result?.hasTokens).toBe(false);
    expect(result?.inputTokens).toBe(0);
    expect(result?.outputTokens).toBe(0);
    expect(result?.cost).toEqual({ totalCost: 0.5, currency: 'USD' });
  });
});
