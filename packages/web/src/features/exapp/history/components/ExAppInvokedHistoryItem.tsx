import { InvokeExAppHistory } from 'genai-web';
import { Link } from 'react-router';
import { linkDefaultStyle } from '@/components/ui/dads/Link';
import { formatDateTime } from '@/utils/formatDateTime';
import { ExAppInvokeHistoryItemStatusLabel } from './ExAppInvokeHistoryItemStatusLabel';

type Props = {
  history: InvokeExAppHistory;
  isCurrent?: boolean;
};

export const ExAppInvokedHistoryItem = (props: Props) => {
  const { history, isCurrent = false } = props;

  return (
    <li className='border-b border-b-solid-gray-420 text-std-16N-175'>
      <Link
        to={`/apps/${history.teamId}/${history.exAppId}/invoke/${history.createdDate}`}
        aria-current={isCurrent ? 'page' : undefined}
        className="group/history flex flex-col gap-1 items-start py-3 pl-2 pr-1.5 hover:bg-solid-gray-50 aria-[current='page']:bg-blue-50 focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-black focus-visible:outline-solid focus-visible:rounded-4 focus-visible:bg-yellow-300 focus-visible:ring-[calc(6/16*1rem)] focus-visible:ring-yellow-300 focus-visible:ring-inset"
      >
        <div className='flex gap-2 items-baseline'>
          <ExAppInvokeHistoryItemStatusLabel status={history.status} />
          <time
            dateTime={new Date(Number(history.createdDate)).toISOString()}
            className='flex-1 min-w-0 text-dns-16N-130 underline-offset-[calc(3/16*1rem)] group-hover/history:underline'
          >
            <span className='sr-only'>実行日時：</span>
            {formatDateTime(history.createdDate)}
          </time>
        </div>
        {history.predictedTitle && (
          <p
            className={`${linkDefaultStyle} group-hover/history:text-blue-900 group-hover/history:decoration-[calc(3/16*1rem)] group-aria-[current='page']/history:font-bold group-aria-[current='page']/history:text-blue-1000!`}
          >
            {history.predictedTitle}
          </p>
        )}
      </Link>
    </li>
  );
};
