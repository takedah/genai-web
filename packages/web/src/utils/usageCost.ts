import type { UsageCostEntry } from 'genai-web';

// 通貨コード比較は前後空白除去＋大文字に正規化する。
const normalizeCurrency = (value: string): string => value.trim().toUpperCase();

// 円表示の小数桁。要件「3.1円」に合わせて第1位まで。
const JPY_FRACTION_DIGITS = 1;
// 円以外の通貨の小数桁（既定）。
const DEFAULT_FRACTION_DIGITS = 4;

export type CostAmount = {
  totalCost: number;
  currency: string;
};

export type AggregatedUsageCost = {
  // 集約 input（キャッシュ込み）の総和。
  inputTokens: number;
  // 出力の総和。
  outputTokens: number;
  // 生通貨のコスト合算。currency 不一致や estimatedCost 全欠では undefined。
  cost?: CostAmount;
  // コスト合算対象（estimatedCost を持つエントリ）すべてが converted を持ち、通貨一致のときのみ。
  convertedCost?: CostAmount;
};

// formatDisplayCost が受け取る最小構造。cost / convertedCost のみ参照する。
export type CostDisplayInput = {
  cost?: CostAmount;
  convertedCost?: CostAmount;
};

// 複数の CostAmount を currency 一致時のみ合算する。
// 1 つも対象が無ければ undefined、currency 不一致でも undefined。
export const sumCostAmounts = (amounts: CostAmount[]): CostAmount | undefined => {
  if (amounts.length === 0) return undefined;
  let total = 0;
  let unifiedNormalized: string | undefined;
  let unifiedOriginal: string | undefined;
  for (const amount of amounts) {
    const normalized = normalizeCurrency(amount.currency);
    if (unifiedNormalized === undefined) {
      unifiedNormalized = normalized;
      unifiedOriginal = amount.currency;
    } else if (unifiedNormalized !== normalized) {
      return undefined;
    }
    total += amount.totalCost;
  }
  return { totalCost: total, currency: unifiedOriginal as string };
};

// 1 メッセージ分の usageCostHistory[] を合算する。
// トークンは常に総和。コストは estimatedCost を持つエントリのみ、currency 一致時に合算。
export const aggregateUsageCostEntries = (
  entries: UsageCostEntry[] | undefined,
): AggregatedUsageCost | undefined => {
  if (!entries || entries.length === 0) return undefined;

  let inputTokens = 0;
  let outputTokens = 0;
  const costAmounts: CostAmount[] = [];
  const convertedAmounts: CostAmount[] = [];
  let allHaveConverted = true;

  for (const entry of entries) {
    inputTokens += entry.usage.inputTokens;
    outputTokens += entry.usage.outputTokens;

    // estimatedCost が無いエントリはコスト合算対象外。converted 可否判定にも含めない。
    const estimatedCost = entry.estimatedCost;
    if (!estimatedCost) {
      continue;
    }
    costAmounts.push({
      totalCost: estimatedCost.totalCost,
      currency: estimatedCost.currency,
    });
    if (estimatedCost.converted) {
      convertedAmounts.push({
        totalCost: estimatedCost.converted.totalCost,
        currency: estimatedCost.converted.currency,
      });
    } else {
      allHaveConverted = false;
    }
  }

  const cost = sumCostAmounts(costAmounts);
  // converted はコスト対象エントリすべてが持つ場合のみ合算する（一部欠落なら付与しない）。
  const convertedCost =
    allHaveConverted && convertedAmounts.length > 0 ? sumCostAmounts(convertedAmounts) : undefined;

  return { inputTokens, outputTokens, cost, convertedCost };
};

const isJpy = (currency: string): boolean => normalizeCurrency(currency) === 'JPY';

const formatCostAmount = (amount: CostAmount): string => {
  if (isJpy(amount.currency)) {
    const value = amount.totalCost.toLocaleString('ja-JP', {
      maximumFractionDigits: JPY_FRACTION_DIGITS,
    });
    return `${value}円`;
  }
  const value = amount.totalCost.toLocaleString('ja-JP', {
    maximumFractionDigits: DEFAULT_FRACTION_DIGITS,
  });
  return `${value} ${amount.currency}`;
};

// 表示用コスト文字列。converted（例 JPY）を優先し、なければ生通貨。
// どちらも無ければ undefined。
export const formatDisplayCost = (agg: CostDisplayInput | undefined): string | undefined => {
  if (!agg) return undefined;
  if (agg.convertedCost) return formatCostAmount(agg.convertedCost);
  if (agg.cost) return formatCostAmount(agg.cost);
  return undefined;
};

// トークン数の桁区切り表示。
export const formatTokens = (tokens: number): string => tokens.toLocaleString('ja-JP');
