import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateCost, loadPricing } from '../../../lambda/utils/costEstimator';

describe('costEstimator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadPricing', () => {
    it('バンドル済み JSON から定義を読み込み、main モデルが含まれる', () => {
      const registry = loadPricing();
      // main の MODEL_IDS デフォルト 4 件は必ず含まれる
      expect(registry['jp.anthropic.claude-sonnet-4-6']).toBeDefined();
      expect(registry['jp.anthropic.claude-sonnet-4-5-20250929-v1:0']).toBeDefined();
      expect(registry['jp.anthropic.claude-haiku-4-5-20251001-v1:0']).toBeDefined();
      expect(registry['amazon.nova-lite-v1:0']).toBeDefined();
    });

    it('外部 JSON ファイルパス指定でロードできる', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'pricing-'));
      const file = path.join(dir, 'pricing.json');
      writeFileSync(
        file,
        JSON.stringify({
          models: {
            'test-model': {
              currency: 'JPY',
              pricingUnit: 1000,
              tokenCategories: { inputTokens: { unitPrice: 1 } },
            },
          },
        }),
      );
      const registry = loadPricing(file);
      expect(registry['test-model']).toMatchObject({
        currency: 'JPY',
        pricingUnit: 1000,
      });
    });

    it('ファイル不在は空レジストリ＋warn ログ（フェイルセーフ）', () => {
      const registry = loadPricing('/nonexistent/path/pricing.json');
      expect(registry).toEqual({});
      expect(console.warn).toHaveBeenCalled();
    });

    it('不正 JSON は空レジストリ＋warn', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'pricing-'));
      const file = path.join(dir, 'bad.json');
      writeFileSync(file, '{not valid');
      const registry = loadPricing(file);
      expect(registry).toEqual({});
      expect(console.warn).toHaveBeenCalled();
    });

    it('個別モデルの定義不正はそのモデルのみスキップして継続', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'pricing-'));
      const file = path.join(dir, 'partial.json');
      writeFileSync(
        file,
        JSON.stringify({
          models: {
            'broken-model': { pricingUnit: -1, tokenCategories: {} },
            'good-model': {
              pricingUnit: 1000,
              tokenCategories: { inputTokens: { unitPrice: 0.5 } },
            },
          },
        }),
      );
      const registry = loadPricing(file);
      expect(registry['broken-model']).toBeUndefined();
      expect(registry['good-model']).toBeDefined();
    });
  });

  describe('estimateCost', () => {
    it('claude-sonnet-4-6 の input/output を per-1M 単価で計算（手計算検証）', () => {
      // 1000 input × $3.30/1M = 0.0033, 500 output × $16.50/1M = 0.00825 → 0.01155
      const result = estimateCost('jp.anthropic.claude-sonnet-4-6', {
        inputTokens: 1000,
        outputTokens: 500,
      });
      expect(result?.totalCost).toBeCloseTo(0.01155, 8);
      expect(result?.currency).toBe('USD');
    });

    it('cacheRead/cacheWrite を別単価で加算する', () => {
      // input 1000×3.30/1M=0.0033, output 0, cacheRead 500×0.33/1M=0.000165, cacheWrite 200×4.125/1M=0.000825
      const result = estimateCost('jp.anthropic.claude-sonnet-4-6', {
        inputTokens: 1000,
        outputTokens: 0,
        cacheReadInputTokens: 500,
        cacheWriteInputTokens: 200,
      });
      expect(result?.totalCost).toBeCloseTo(0.0033 + 0.000165 + 0.000825, 8);
    });

    it('pricing 未定義モデルでは undefined を返す', () => {
      const result = estimateCost('unknown-model', {
        inputTokens: 100,
        outputTokens: 50,
      });
      expect(result).toBeUndefined();
    });

    it('raw が undefined なら undefined を返す', () => {
      const result = estimateCost('jp.anthropic.claude-sonnet-4-6', undefined);
      expect(result).toBeUndefined();
    });

    it('全カテゴリ 0 トークンなら undefined を返す', () => {
      const result = estimateCost('jp.anthropic.claude-sonnet-4-6', {
        inputTokens: 0,
        outputTokens: 0,
      });
      expect(result).toBeUndefined();
    });

    it('環境変数が揃っていれば converted を付与する', () => {
      vi.stubEnv('COST_CONVERSION_TO_CURRENCY', 'JPY');
      vi.stubEnv('COST_CONVERSION_RATE', '150');
      vi.stubEnv('COST_CONVERSION_ALLOWED_FROM', 'USD');
      const result = estimateCost('jp.anthropic.claude-sonnet-4-6', {
        inputTokens: 1000,
        outputTokens: 0,
      });
      expect(result?.converted).toMatchObject({
        currency: 'JPY',
        rate: 150,
        fromCurrency: 'USD',
      });
      vi.unstubAllEnvs();
    });
  });
});
