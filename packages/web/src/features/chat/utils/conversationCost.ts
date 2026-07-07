import type { ShownMessage } from 'genai-web';
import { aggregateUsageCostEntries, type CostAmount, sumCostAmounts } from '@/utils/usageCost';

export type ConversationCost = {
  // 全 assistant メッセージのトークン総和（estimatedCost の有無に関わらず集計）。
  inputTokens: number;
  outputTokens: number;
  cost?: CostAmount;
  convertedCost?: CostAmount;
};

// 会話全体（全 assistant メッセージ）のトークン・コスト合算。
// トークンは usage があれば常に集計し、コストは estimatedCost を持つ分のみ通貨一致時に合算する。
export const aggregateConversationCost = (
  messages: ShownMessage[],
): ConversationCost | undefined => {
  const costAmounts: CostAmount[] = [];
  const convertedAmounts: CostAmount[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let anyMessage = false;
  let allHaveConverted = true;

  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const agg = aggregateUsageCostEntries(message.usageCostHistory);
    if (!agg) continue;
    anyMessage = true;
    inputTokens += agg.inputTokens;
    outputTokens += agg.outputTokens;
    // コストが無いメッセージはコスト合算対象外。converted 可否判定にも含めない。
    if (!agg.cost) {
      continue;
    }
    costAmounts.push(agg.cost);
    if (agg.convertedCost) {
      convertedAmounts.push(agg.convertedCost);
    } else {
      allHaveConverted = false;
    }
  }

  if (!anyMessage) return undefined;

  const cost = sumCostAmounts(costAmounts);
  const convertedCost =
    allHaveConverted && convertedAmounts.length > 0 ? sumCostAmounts(convertedAmounts) : undefined;

  return { inputTokens, outputTokens, cost, convertedCost };
};
