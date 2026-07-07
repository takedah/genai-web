import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { PageTitle } from '@/components/PageTitle';
import { Button } from '@/components/ui/dads/Button';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { APP_TITLE } from '@/constants';
import { formatDateTime } from '@/utils/formatDateTime';
import { isJSON } from '@/utils/isJSON';
import { useFetchExApp } from '../../hooks/useFetchExApp';
import { GovAIFormUIJson } from '../../types';
import { useFetchExAppHistoryItem } from '../hooks/useFetchExAppHistoryItem';
import { getExAppHistoriesKey } from '../hooks/useFetchInvokedExAppHistories';
import { ExAppHeader } from './ExAppHeader';
import { ExAppHistoryInputs } from './ExAppHistoryInputs';
import { ExAppHistoryOutputs } from './ExAppHistoryOutputs';
import { ExAppHistorySidebar } from './ExAppHistorySidebar';
import { ExAppInvokedHistoryDeleteDialog } from './ExAppInvokedHistoryDeleteDialog';
import { ExAppInvokeHistoryItemStatusLabel } from './ExAppInvokeHistoryItemStatusLabel';

export const ExAppHistoryPageContent = () => {
  const {
    teamId = '',
    exAppId = '',
    createdDate = '',
  } = useParams<{ teamId: string; exAppId: string; createdDate: string }>();
  const navigate = useNavigate();

  const { mutate: globalMutate } = useSWRConfig();
  const { data: exApp } = useFetchExApp(teamId, exAppId);
  const { data: historyResponse, mutate: mutateHistory } = useFetchExAppHistoryItem(
    teamId,
    exAppId,
    createdDate,
  );
  const history = historyResponse.history;

  const [shouldShowDeleteDialog, setShouldShowDeleteDialog] = useState(false);

  const parse = (text: string): string => {
    if (text === '{}' || text === '') return '';
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') return parsed;
      return JSON.stringify(parsed);
    } catch {
      return text;
    }
  };

  const isPrevVersionResponse = !Object.keys(history).includes('status');

  const resolvedStatus = (() => {
    if (!isPrevVersionResponse) return history.status;
    try {
      const parsed = JSON.parse(history.outputs);
      return parsed?.code ? 'ERROR' : 'COMPLETED';
    } catch {
      return 'COMPLETED';
    }
  })();

  const parsedOutputs = (() => {
    if (resolvedStatus !== 'COMPLETED') return '';
    if (!isPrevVersionResponse) return parse(history.outputs);

    try {
      const parsed = JSON.parse(history.outputs);
      return parsed?.outputs ?? '';
    } catch {
      return '';
    }
  })();

  const systemPromptKey =
    exApp.systemPromptKeyName && exApp.systemPromptKeyName.length > 0
      ? exApp.systemPromptKeyName
      : 'system_prompt';

  const uiJson = useMemo<GovAIFormUIJson | undefined>(() => {
    return isJSON(exApp.placeholder) ? JSON.parse(exApp.placeholder) : undefined;
  }, [exApp]);

  const shouldShowConversationHistory = exApp.placeholder.includes('conversation_history');

  const historyTitle = history.predictedTitle || `${formatDateTime(history.createdDate)} の履歴`;

  return (
    <>
      <PageTitle title={`${historyTitle} | ${exApp.exAppName} | ${APP_TITLE}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <ExAppHeader exApp={exApp} teamId={teamId} exAppId={exAppId} historyTitle={historyTitle} />
        <div className='flex flex-col gap-4 lg:gap-10 lg:justify-between lg:flex-row xl:gap-16'>
          <div className='flex-1 min-w-0 py-4 lg:py-6'>
            <div>
              <h2 className='mb-4 flex items-baseline gap-2 text-std-18B-160'>
                <ExAppInvokeHistoryItemStatusLabel status={resolvedStatus!} />
                <time dateTime={new Date(Number(history.createdDate)).toISOString()}>
                  <span className='sr-only'>実行日時：</span>
                  {formatDateTime(history.createdDate)}
                </time>
              </h2>

              <div className='flex flex-col gap-4'>
                <ExAppHistoryInputs
                  inputs={history.inputs}
                  systemPromptKey={systemPromptKey}
                  uiJson={uiJson}
                />

                <ExAppHistoryOutputs
                  status={resolvedStatus!}
                  parsedOutputs={parsedOutputs}
                  progress={history.progress}
                  artifacts={history.artifacts}
                  usageMetadata={history.usageMetadata}
                  totalEstimatedCost={history.totalEstimatedCost}
                  onReload={async () => {
                    await Promise.all([
                      mutateHistory(),
                      globalMutate(unstable_serialize(getExAppHistoriesKey(teamId, exAppId))),
                    ]);
                  }}
                />

                <div className='relative flex min-h-8 flex-col items-center justify-center gap-4 desktop:mt-6'>
                  {resolvedStatus === 'COMPLETED' && shouldShowConversationHistory && (
                    <LoadingButton
                      onClick={() => {
                        localStorage.setItem('history', JSON.stringify(history));
                        location.href = `/apps/${history.teamId}/${history.exAppId}/invoke`;
                      }}
                      variant='outline'
                      size='lg'
                      className='w-60'
                    >
                      会話を続ける
                    </LoadingButton>
                  )}
                  <Button
                    onClick={() => setShouldShowDeleteDialog(true)}
                    variant='text'
                    size='lg'
                    type='button'
                    className='text-error-1! hover:bg-red-50! hover:text-error-2! active:bg-red-50! active:text-error-2!'
                  >
                    この利用履歴を削除する
                  </Button>
                </div>
              </div>

              {shouldShowDeleteDialog && (
                <ExAppInvokedHistoryDeleteDialog
                  history={history}
                  isOpen={shouldShowDeleteDialog}
                  setIsOpen={setShouldShowDeleteDialog}
                  onDeleted={() => {
                    setShouldShowDeleteDialog(false);
                    navigate(`/apps/${teamId}/${exAppId}/invoke`);
                  }}
                />
              )}
            </div>
          </div>
          <div className='min-w-0 lg:shrink-0 lg:w-56 xl:w-64'>
            <div className='pt-4 pb-2 lg:sticky lg:top-[calc(var(--header-height))]'>
              <div className='grid grid-cols-1 grid-rows-[auto_1fr] max-h-[calc(100vh-var(--header-height)-1.5rem)] gap-6'>
                <Button
                  variant='solid-fill'
                  size='lg'
                  className='inline-flex justify-center items-center w-full'
                  asChild
                >
                  <Link to={`/apps/${teamId}/${exAppId}/invoke`}>新しく会話を始める</Link>
                </Button>
                <ExAppHistorySidebar exApp={exApp} currentCreatedDate={createdDate} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
