import { render } from '@testing-library/react';
import type { ShownMessage, UsageCostEntry } from 'genai-web';
import { describe, expect, it } from 'vitest';
import { ConversationTotalCost } from '../../../src/features/chat/components/ConversationTotalCost';

const usdJpyEntry = (usd: number, jpy: number): UsageCostEntry => ({
  usage: {
    model: 'jp.anthropic.claude-opus-4-8',
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
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

const assistant = (entries?: UsageCostEntry[]): ShownMessage => ({
  role: 'assistant',
  content: 'answer',
  ...(entries !== undefined ? { usageCostHistory: entries } : {}),
});

const user = (): ShownMessage => ({ role: 'user', content: 'question' });

describe('ConversationTotalCost', () => {
  it('全 assistant メッセージのトークンとコストを合算して表示する', () => {
    const { container } = render(
      <ConversationTotalCost
        messages={[
          user(),
          assistant([usdJpyEntry(0.01, 1.5)]),
          user(),
          assistant([usdJpyEntry(0.02, 3.0)]),
        ]}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('合計トークン数：入力 200 トークン');
    expect(text).toContain('出力 40 トークン');
    expect(text).toContain('会話の合計コスト：4.5円');
  });

  it('estimatedCost が無くてもトークン合計は表示しコスト行は出さない', () => {
    const { container } = render(
      <ConversationTotalCost messages={[assistant([tokenOnlyEntry(150, 30)])]} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('入力 150 トークン');
    expect(text).toContain('出力 30 トークン');
    expect(text).not.toContain('会話の合計コスト');
  });

  it('usage を持つ assistant が無ければ何も描画しない', () => {
    const { container } = render(<ConversationTotalCost messages={[user(), assistant()]} />);
    expect(container.firstChild).toBeNull();
  });

  it('空の会話では何も描画しない', () => {
    const { container } = render(<ConversationTotalCost messages={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
