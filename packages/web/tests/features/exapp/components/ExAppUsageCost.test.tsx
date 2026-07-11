import { render } from '@testing-library/react';
import type { EstimatedCostSummary, UsageMetadata } from 'genai-web';
import { describe, expect, it } from 'vitest';
import { ExAppUsageCost } from '../../../../src/features/exapp/components/ExAppUsageCost';

const metadata = (prompt: number, candidates: number): UsageMetadata => ({
  modelVersion: 'gemini-x',
  requestCount: 1,
  tokens: {
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    totalTokenCount: prompt + candidates,
  },
});

const usdJpy = (usdCost: number, jpyCost: number): EstimatedCostSummary => ({
  totalCost: usdCost,
  currency: 'USD',
  converted: { totalCost: jpyCost, currency: 'JPY', rate: 150, fromCurrency: 'USD' },
});

describe('ExAppUsageCost', () => {
  it('トークンとコスト（円）を表示する', () => {
    const { container } = render(
      <ExAppUsageCost
        usageMetadata={[metadata(699290, 34336)]}
        totalEstimatedCost={usdJpy(0.02, 3.14)}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('トークン数：入力 699,290 トークン');
    expect(text).toContain('出力 34,336 トークン');
    expect(text).toContain('推定コスト：3.1円');
  });

  it('usageMetadata が無くコストのみの場合はトークン行を出さずコストのみ表示する', () => {
    const { container } = render(
      <ExAppUsageCost usageMetadata={undefined} totalEstimatedCost={usdJpy(0.02, 3.14)} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('トークン数');
    expect(text).toContain('推定コスト：3.1円');
  });

  it('usageMetadata のみでコストが無い場合はトークンのみ表示する', () => {
    const { container } = render(
      <ExAppUsageCost usageMetadata={[metadata(100, 20)]} totalEstimatedCost={undefined} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('入力 100 トークン');
    expect(text).not.toContain('コスト');
  });

  it('両方なければ何も描画しない', () => {
    const { container } = render(
      <ExAppUsageCost usageMetadata={undefined} totalEstimatedCost={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
