import type { EstimatedCostSummary, UsageMetadata } from 'genai-web';
import type { CostAmount } from '@/utils/usageCost';

export type ExAppUsageCost = {
  // usageMetadata 全件の promptTokenCount 合算。
  inputTokens: number;
  // usageMetadata 全件の candidatesTokenCount 合算。
  outputTokens: number;
  // サーバ集約済みの生コスト（再合算しない）。
  cost?: CostAmount;
  // サーバ集約済みの変換コスト（許可時のみ付与）。
  convertedCost?: CostAmount;
  // usageMetadata が無い過去履歴ではトークン行を出さないための判定。
  hasTokens: boolean;
};

// exapp の usageMetadata（Gemini 命名）と totalEstimatedCost を、表示用の形へ変換する。
// totalEstimatedCost はサーバ側で合算済みのため、ここでは再合算しない。
export const aggregateExAppUsageCost = (
  usageMetadata: UsageMetadata[] | undefined,
  totalEstimatedCost: EstimatedCostSummary | undefined,
): ExAppUsageCost | undefined => {
  const hasTokens = !!usageMetadata && usageMetadata.length > 0;

  let inputTokens = 0;
  let outputTokens = 0;
  if (hasTokens) {
    for (const metadata of usageMetadata) {
      inputTokens += metadata.tokens.promptTokenCount;
      outputTokens += metadata.tokens.candidatesTokenCount;
    }
  }

  const cost = totalEstimatedCost
    ? { totalCost: totalEstimatedCost.totalCost, currency: totalEstimatedCost.currency }
    : undefined;
  const convertedCost = totalEstimatedCost?.converted
    ? {
        totalCost: totalEstimatedCost.converted.totalCost,
        currency: totalEstimatedCost.converted.currency,
      }
    : undefined;

  if (!hasTokens && !cost) {
    return undefined;
  }

  return { inputTokens, outputTokens, cost, convertedCost, hasTokens };
};
