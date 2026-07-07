import type { EstimatedCostSummary } from 'genai-web';

// 環境変数キー（マジックストリング回避）。
const ENV_TO_CURRENCY = 'COST_CONVERSION_TO_CURRENCY';
const ENV_RATE = 'COST_CONVERSION_RATE';
const ENV_ALLOWED_FROM = 'COST_CONVERSION_ALLOWED_FROM';

// EstimatedCostInfo.currency が未指定のときの既定通貨。
const DEFAULT_INFO_CURRENCY = 'USD';

const normalizeCurrency = (value: string): string => value.toUpperCase();

const parseAllowed = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeCurrency);

// totalCost と originCurrency から converted を安全に付与する純粋関数。
// 保存値（summary.currency / converted.fromCurrency / converted.currency）は
// プロバイダ・環境変数の原表記をそのまま保持する。
export const buildSummary = (
  totalCost: number,
  originCurrency: string | undefined,
): EstimatedCostSummary => {
  const fromCurrency = originCurrency ?? DEFAULT_INFO_CURRENCY;
  const summary: EstimatedCostSummary = { totalCost, currency: fromCurrency };

  const toCurrency = process.env[ENV_TO_CURRENCY];
  const rateStr = process.env[ENV_RATE];
  const allowed = parseAllowed(process.env[ENV_ALLOWED_FROM]);
  const rate = rateStr ? Number(rateStr) : Number.NaN;
  const fromUpper = normalizeCurrency(fromCurrency);
  const toUpper = toCurrency ? normalizeCurrency(toCurrency) : undefined;

  if (
    toUpper &&
    Number.isFinite(rate) &&
    rate > 0 &&
    allowed.length > 0 &&
    allowed.includes(fromUpper) &&
    fromUpper !== toUpper
  ) {
    summary.converted = {
      totalCost: totalCost * rate,
      // toCurrency は undefined チェック済み
      currency: toCurrency as string,
      rate,
      fromCurrency,
    };
  }
  return summary;
};

// invokeExApp 用: usageMetadata[] から estimatedCostInfo.estimatedCost を合算する。
// converted は環境変数 SSOT 由来のため rate 混在は構造上発生せず、buildSummary に委譲してよい。
export const summarizeFromUsageMetadata = (
  usageMetadata:
    | ReadonlyArray<{
        estimatedCostInfo?: { estimatedCost?: unknown; currency?: unknown };
      }>
    | undefined,
): EstimatedCostSummary | undefined => {
  if (!usageMetadata || usageMetadata.length === 0) return undefined;

  let total = 0;
  let any = false;
  let unifiedOriginal: string | undefined;
  let unifiedNormalized: string | undefined;

  for (const m of usageMetadata) {
    const info = m.estimatedCostInfo;
    if (!info || typeof info.estimatedCost !== 'number' || !Number.isFinite(info.estimatedCost)) {
      continue;
    }
    const original =
      typeof info.currency === 'string' && info.currency.length > 0
        ? info.currency
        : DEFAULT_INFO_CURRENCY;
    const normalized = normalizeCurrency(original);
    if (unifiedNormalized === undefined) {
      unifiedNormalized = normalized;
      unifiedOriginal = original;
    } else if (unifiedNormalized !== normalized) {
      console.warn('summarizeFromUsageMetadata: currency mismatch, skipping aggregation', {
        unified: unifiedNormalized,
        encountered: normalized,
      });
      return undefined;
    }
    total += info.estimatedCost;
    any = true;
  }

  if (!any) return undefined;
  return buildSummary(total, unifiedOriginal);
};
