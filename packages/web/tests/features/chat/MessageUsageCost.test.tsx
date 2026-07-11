import { render } from '@testing-library/react';
import type { UsageCostEntry } from 'genai-web';
import { describe, expect, it } from 'vitest';
import { MessageUsageCost } from '../../../src/features/chat/components/MessageUsageCost';

const usdJpyEntry = (input: number, output: number, usd: number, jpy: number): UsageCostEntry => ({
  usage: {
    model: 'jp.anthropic.claude-opus-4-8',
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
  },
  estimatedCost: {
    totalCost: usd,
    currency: 'USD',
    converted: { totalCost: jpy, currency: 'JPY', rate: 150, fromCurrency: 'USD' },
  },
});

const tokenOnlyEntry = (input: number, output: number): UsageCostEntry => ({
  usage: {
    model: 'jp.anthropic.claude-opus-4-8',
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
  },
});

describe('MessageUsageCost', () => {
  it('トークンとコスト（円）を表示する', () => {
    const { container } = render(
      <MessageUsageCost usageCostHistory={[usdJpyEntry(699290, 34336, 0.02, 3.14)]} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('トークン数：入力 699,290 トークン');
    expect(text).toContain('出力 34,336 トークン');
    expect(text).toContain('この会話にかかったコスト：3.1円');
  });

  it('estimatedCost が無い場合はトークンのみ表示しコスト文言を出さない', () => {
    const { container } = render(<MessageUsageCost usageCostHistory={[tokenOnlyEntry(100, 20)]} />);
    const text = container.textContent ?? '';
    expect(text).toContain('入力 100 トークン');
    expect(text).not.toContain('コスト');
  });

  it('usageCostHistory が空なら何も描画しない', () => {
    const { container } = render(<MessageUsageCost usageCostHistory={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('usageCostHistory が undefined なら何も描画しない', () => {
    const { container } = render(<MessageUsageCost usageCostHistory={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
