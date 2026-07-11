import type { UsageCostEntry } from 'genai-web';
import { aggregateUsageCostEntries, formatDisplayCost, formatTokens } from '@/utils/usageCost';

type Props = {
  usageCostHistory?: UsageCostEntry[];
};

export const DiagramUsageCost = ({ usageCostHistory }: Props) => {
  const aggregated = aggregateUsageCostEntries(usageCostHistory);
  if (!aggregated) {
    return null;
  }

  const cost = formatDisplayCost(aggregated);

  return (
    <div className='mt-4 mb-1 text-right'>
      <p className='text-solid-gray-600'>
        トークン数：入力 {formatTokens(aggregated.inputTokens)} トークン / 出力{' '}
        {formatTokens(aggregated.outputTokens)} トークン
      </p>
      {cost && <p className='mt-1 font-bold text-red-800'>推定コスト：{cost}</p>}
    </div>
  );
};
