import type { ShownMessage } from 'genai-web';
import { aggregateConversationCost } from '@/features/chat/utils/conversationCost';
import { formatDisplayCost, formatTokens } from '@/utils/usageCost';

type Props = {
  messages: ShownMessage[];
};

export const ConversationTotalCost = ({ messages }: Props) => {
  const aggregated = aggregateConversationCost(messages);
  if (!aggregated) {
    return null;
  }

  const cost = formatDisplayCost(aggregated);

  return (
    <div className='my-1 text-right'>
      <p className='text-solid-gray-600'>
        合計トークン数：入力 {formatTokens(aggregated.inputTokens)} トークン / 出力{' '}
        {formatTokens(aggregated.outputTokens)} トークン
      </p>
      {cost && <p className='mt-1 font-bold text-red-800'>会話の合計コスト：{cost}</p>}
    </div>
  );
};
