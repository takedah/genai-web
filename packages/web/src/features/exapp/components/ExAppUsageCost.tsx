import type { EstimatedCostSummary, UsageMetadata } from 'genai-web';
import { formatDisplayCost, formatTokens } from '@/utils/usageCost';
import { aggregateExAppUsageCost } from '../utils/aggregateExAppUsageCost';

type Props = {
  usageMetadata?: UsageMetadata[];
  totalEstimatedCost?: EstimatedCostSummary;
};

export const ExAppUsageCost = ({ usageMetadata, totalEstimatedCost }: Props) => {
  const aggregated = aggregateExAppUsageCost(usageMetadata, totalEstimatedCost);
  if (!aggregated) {
    return null;
  }

  const cost = formatDisplayCost(aggregated);

  return (
    <div className='mt-4 mb-1 text-right'>
      {aggregated.hasTokens && (
        <p className='text-solid-gray-600'>
          トークン数：入力 {formatTokens(aggregated.inputTokens)} トークン / 出力{' '}
          {formatTokens(aggregated.outputTokens)} トークン
        </p>
      )}
      {cost && <p className='mt-1 font-bold text-red-800'>推定コスト：{cost}</p>}
    </div>
  );
};
