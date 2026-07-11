import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { isJSON } from '@/utils/isJSON';
import { useFetchExApp } from '../../hooks/useFetchExApp';
import { GovAIFormDefaultValue } from '../../types';
import { useExAppInvokeStore } from '../stores/useExAppInvokeStore';
import { DefaultInvokeCheckbox } from './DefaultInvokeCheckbox';
import { ExAppForm } from './ExAppForm';
import { ExAppHeader } from './ExAppHeader';
import { ExAppHistorySidebar } from './ExAppHistorySidebar';
import { ExAppResult } from './ExAppResult';

export const ExAppInvokePageContent = () => {
  const { exAppResponse, requestLoading, error, clear } = useExAppInvokeStore();
  const { pathname } = useLocation();

  const { teamId = '', exAppId = '' } = useParams<{ teamId: string; exAppId: string }>();
  const { data: exApp } = useFetchExApp(teamId, exAppId);

  useEffect(() => {
    clear();
  }, [pathname, clear]);

  const uiJson = useMemo(
    () => (isJSON(exApp.placeholder) ? JSON.parse(exApp.placeholder) : {}),
    [exApp],
  );

  const defaultValuesJson = useMemo(() => {
    const defaultValueExistsKeys = Object.keys(uiJson).filter(
      (key) => uiJson[key]['default_value'],
    );
    const defaultValues: GovAIFormDefaultValue = {};
    for (const key of defaultValueExistsKeys) {
      defaultValues[key] = uiJson[key]['default_value'];
    }
    return defaultValues;
  }, [uiJson]);

  const { liveStatusMessage } = useLiveStatusMessage({
    active: true,
    loading: requestLoading,
    messages: {
      loading: `${exApp.exAppName}が回答を生成しています...`,
      loadingContinue: `${exApp.exAppName}が引き続き回答を生成しています...`,
      completed: exAppResponse?.outputs
        ? `${exApp.exAppName}の回答：${exAppResponse.outputs}`
        : `${exApp.exAppName}の回答がありません。`,
      error: error ? `${exApp.exAppName}のエラー：${error}` : undefined,
    },
  });

  return (
    <>
      <PageTitle title={`${exApp.exAppName}（アプリ実行） | ${APP_TITLE}`} />
      <div className='relative mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <ExAppHeader exApp={exApp} teamId={teamId} exAppId={exAppId} />
        <div className='flex flex-col gap-4 lg:gap-10 lg:justify-between lg:flex-row xl:gap-16'>
          <div className='flex-1 min-w-0 py-4 lg:pt-4.5 lg:pb-6'>
            <div className='pb-4'>
              <DefaultInvokeCheckbox storageKey={`exapp_${exAppId}`} />
            </div>
            <ExAppForm exApp={exApp} uiJson={uiJson} defaultValues={defaultValuesJson} />
            <ExAppResult
              shouldShowConversationHistory={exApp.placeholder.includes('conversation_history')}
            />
          </div>
          <div className='min-w-0 lg:shrink-0 lg:w-56 xl:w-64'>
            <div className='pt-4 pb-2 lg:sticky lg:top-[calc(var(--header-height))] lg:pt-6'>
              <ExAppHistorySidebar exApp={exApp} />
            </div>
          </div>
        </div>

        <div aria-live='assertive' aria-atomic='true' className='sr-only'>
          {liveStatusMessage}
        </div>
      </div>
    </>
  );
};
