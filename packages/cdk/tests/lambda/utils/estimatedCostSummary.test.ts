import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSummary,
  summarizeFromUsageMetadata,
} from '../../../lambda/utils/estimatedCostSummary';

const ENV_TO_CURRENCY = 'COST_CONVERSION_TO_CURRENCY';
const ENV_RATE = 'COST_CONVERSION_RATE';
const ENV_ALLOWED_FROM = 'COST_CONVERSION_ALLOWED_FROM';

describe('estimatedCostSummary', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_TO_CURRENCY, '');
    vi.stubEnv(ENV_RATE, '');
    vi.stubEnv(ENV_ALLOWED_FROM, '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('buildSummary', () => {
    it('環境変数が未設定なら converted を付与しない', () => {
      const result = buildSummary(1.5, 'USD');
      expect(result).toEqual({ totalCost: 1.5, currency: 'USD' });
    });

    it('環境変数が全て揃って許可リストに含まれていれば converted を付与する', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_RATE, '150');
      vi.stubEnv(ENV_ALLOWED_FROM, 'USD,EUR');
      const result = buildSummary(2.0, 'USD');
      expect(result).toEqual({
        totalCost: 2.0,
        currency: 'USD',
        converted: {
          totalCost: 300,
          currency: 'JPY',
          rate: 150,
          fromCurrency: 'USD',
        },
      });
    });

    it('originCurrency 未指定時は USD を既定として converted を付与する', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_RATE, '150');
      vi.stubEnv(ENV_ALLOWED_FROM, 'USD');
      const result = buildSummary(1, undefined);
      expect(result.currency).toBe('USD');
      expect(result.converted?.currency).toBe('JPY');
      expect(result.converted?.fromCurrency).toBe('USD');
    });

    it('rate が不正値（負・0・NaN・空文字）なら converted を付与しない', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_ALLOWED_FROM, 'USD');
      for (const bad of ['-1', '0', 'abc', '']) {
        vi.stubEnv(ENV_RATE, bad);
        const result = buildSummary(1, 'USD');
        expect(result.converted).toBeUndefined();
      }
    });

    it('許可リストに含まれない fromCurrency なら converted を付与しない', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_RATE, '150');
      vi.stubEnv(ENV_ALLOWED_FROM, 'EUR');
      const result = buildSummary(1, 'USD');
      expect(result.converted).toBeUndefined();
    });

    it('fromCurrency と toCurrency が同じ場合は converted を付与しない', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_RATE, '1');
      vi.stubEnv(ENV_ALLOWED_FROM, 'JPY');
      const result = buildSummary(1, 'JPY');
      expect(result.converted).toBeUndefined();
    });

    it('通貨コードの大小文字差異を正規化して同等視する', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'jpy');
      vi.stubEnv(ENV_RATE, '150');
      vi.stubEnv(ENV_ALLOWED_FROM, 'usd, EUR');
      const result = buildSummary(1, 'Usd');
      // 比較は大文字で実施されるが、保存値は原表記のまま
      expect(result.currency).toBe('Usd');
      expect(result.converted?.currency).toBe('jpy');
      expect(result.converted?.fromCurrency).toBe('Usd');
    });

    it('fromCurrency と toCurrency が大小文字違いだけなら converted を付与しない', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'jpy');
      vi.stubEnv(ENV_RATE, '1');
      vi.stubEnv(ENV_ALLOWED_FROM, 'JPY');
      const result = buildSummary(1, 'JPY');
      expect(result.converted).toBeUndefined();
    });

    it('許可リストが空文字の場合は converted を付与しない', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_RATE, '150');
      vi.stubEnv(ENV_ALLOWED_FROM, '');
      const result = buildSummary(1, 'USD');
      expect(result.converted).toBeUndefined();
    });
  });

  describe('summarizeFromUsageMetadata', () => {
    const makeEntry = (estimatedCost: unknown, currency?: string) => ({
      estimatedCostInfo:
        currency === undefined
          ? ({ estimatedCost } as Record<string, unknown>)
          : ({ estimatedCost, currency } as Record<string, unknown>),
    });

    it('undefined / 空配列なら undefined を返す', () => {
      expect(summarizeFromUsageMetadata(undefined)).toBeUndefined();
      expect(summarizeFromUsageMetadata([])).toBeUndefined();
    });

    it('estimatedCost が number でない要素はスキップする', () => {
      const result = summarizeFromUsageMetadata([
        makeEntry('1.0' as unknown, 'USD'),
        makeEntry(Number.NaN, 'USD'),
        makeEntry(0.5, 'USD'),
        makeEntry(0.25, 'USD'),
      ]);
      expect(result).toEqual({ totalCost: 0.75, currency: 'USD' });
    });

    it('全エントリが無効値なら undefined を返す', () => {
      const result = summarizeFromUsageMetadata([
        makeEntry('1' as unknown, 'USD'),
        makeEntry(Number.NaN, 'USD'),
      ]);
      expect(result).toBeUndefined();
    });

    it('currency が大小文字違いだけなら同等視して合算する', () => {
      const result = summarizeFromUsageMetadata([
        makeEntry(0.1, 'usd'),
        makeEntry(0.2, 'USD'),
      ]);
      expect(result?.totalCost).toBeCloseTo(0.3);
      expect(result?.currency).toBe('usd');
    });

    it('currency 未指定エントリは USD として扱われる', () => {
      const result = summarizeFromUsageMetadata([
        makeEntry(0.1) as { estimatedCostInfo: { estimatedCost: number } },
        makeEntry(0.2, 'usd'),
      ]);
      expect(result?.totalCost).toBeCloseTo(0.3);
      expect(result?.currency).toBe('USD');
    });

    it('currency 混在時は undefined を返し warn ログを出力する', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = summarizeFromUsageMetadata([
        makeEntry(0.1, 'USD'),
        makeEntry(0.2, 'JPY'),
      ]);
      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it('未知プロバイダフィールドは破棄せず、合算は壊れない', () => {
      const result = summarizeFromUsageMetadata([
        {
          estimatedCostInfo: {
            estimatedCost: 0.5,
            currency: 'USD',
            unknownField: { nested: true },
          } as Record<string, unknown>,
        },
      ]);
      expect(result).toEqual({ totalCost: 0.5, currency: 'USD' });
    });

    it('環境変数が揃っていれば converted を付与する', () => {
      vi.stubEnv(ENV_TO_CURRENCY, 'JPY');
      vi.stubEnv(ENV_RATE, '150');
      vi.stubEnv(ENV_ALLOWED_FROM, 'USD');
      const result = summarizeFromUsageMetadata([
        makeEntry(0.5, 'USD'),
        makeEntry(0.25, 'USD'),
      ]);
      expect(result?.converted).toEqual({
        totalCost: 112.5,
        currency: 'JPY',
        rate: 150,
        fromCurrency: 'USD',
      });
    });
  });
});
