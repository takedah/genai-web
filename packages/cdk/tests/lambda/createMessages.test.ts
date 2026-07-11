import { describe, expect, it } from 'vitest';
import { sanitizeUsageCostHistory } from '../../lambda/createMessages';

const validUsage = {
  model: 'jp.anthropic.claude-sonnet-4-6',
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
};

describe('sanitizeUsageCostHistory', () => {
  it('undefined / null / 配列以外は undefined を返す（属性ごと落とす）', () => {
    expect(sanitizeUsageCostHistory(undefined)).toBeUndefined();
    expect(sanitizeUsageCostHistory(null)).toBeUndefined();
    expect(sanitizeUsageCostHistory({ usage: validUsage })).toBeUndefined();
    expect(sanitizeUsageCostHistory('not an array')).toBeUndefined();
  });

  it('空配列は undefined を返す', () => {
    expect(sanitizeUsageCostHistory([])).toBeUndefined();
  });

  it('正常な entry はそのまま採用される', () => {
    const entries = [
      { usage: validUsage },
      {
        usage: validUsage,
        estimatedCost: { totalCost: 0.01, currency: 'USD' },
      },
    ];
    expect(sanitizeUsageCostHistory(entries)).toEqual(entries);
  });

  it('usage の必須フィールド欠落エントリは除外される', () => {
    const result = sanitizeUsageCostHistory([
      { usage: validUsage },
      { usage: { ...validUsage, model: '' } }, // 空 model はリジェクト
      { usage: { ...validUsage, inputTokens: '100' } }, // 数値以外
      { usage: { ...validUsage, totalTokens: Number.NaN } }, // NaN
      {}, // usage 欠落
      null, // 非オブジェクト
    ]);
    expect(result).toEqual([{ usage: validUsage }]);
  });

  it('全エントリが不正なら undefined を返す（属性ごと落とす）', () => {
    const result = sanitizeUsageCostHistory([
      { usage: { model: 'x' } },
      'not an object',
      null,
    ]);
    expect(result).toBeUndefined();
  });
});
