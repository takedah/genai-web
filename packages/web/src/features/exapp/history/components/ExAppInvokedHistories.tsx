import { ExApp } from 'genai-web';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { useFocusNewItemOnLoadMore } from '@/hooks/useFocusNewItemOnLoadMore';
import { useExAppInvokedHistories } from '../hooks/useExAppInvokedHistories';
import { ExAppInvokedHistoriesRefreshButton } from './ExAppInvokedHistoriesRefreshButton';
import { ExAppInvokedHistoryItem } from './ExAppInvokedHistoryItem';

type Props = {
  exApp: ExApp;
  currentCreatedDate?: string;
};

export const ExAppInvokedHistories = (props: Props) => {
  const { exApp, currentCreatedDate } = props;

  const { histories, hasMore, isLoadingMore, loadMore } = useExAppInvokedHistories(
    exApp.teamId,
    exApp.exAppId,
  );

  const { listRef, loadMoreWithFocus } = useFocusNewItemOnLoadMore<HTMLUListElement>({
    itemsLength: histories.length,
    focusSelector: 'a',
  });

  return (
    <>
      <ExAppInvokedHistoriesRefreshButton exApp={exApp} />

      {histories.length === 0 ? (
        <p className='mt-3 text-std-16N-170 text-solid-gray-600'>利用履歴はありません</p>
      ) : (
        <>
          <ul
            ref={listRef}
            className='flex flex-col min-h-0 overflow-y-auto [scrollbar-gutter:stable]'
          >
            {histories.map((history) => {
              const isCurrent = currentCreatedDate === history.createdDate;

              return (
                <ExAppInvokedHistoryItem
                  key={`${history.teamId}-${history.exAppId}-${history.userId}-${history.createdDate}`}
                  history={history}
                  isCurrent={isCurrent}
                />
              );
            })}
          </ul>

          {hasMore && (
            <LoadingButton
              loading={isLoadingMore}
              onClick={() => loadMoreWithFocus(loadMore)}
              className='mt-5'
              variant='outline'
              size='md'
              type='button'
            >
              {isLoadingMore ? '読み込み中' : 'さらに履歴を読み込む'}
            </LoadingButton>
          )}
        </>
      )}
    </>
  );
};
