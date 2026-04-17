import { Suspense, useEffect, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation, useParams } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { Divider } from '@/components/ui/dads/Divider';
import { ErrorText } from '@/components/ui/dads/ErrorText';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { APP_TITLE } from '@/constants';
import { ExAppForm } from '@/features/exapp/components/ExAppForm';
import { ExAppHeader } from '@/features/exapp/components/ExAppHeader';
import { ExAppInvokedHistories } from '@/features/exapp/components/ExAppInvokedHistories';
import { ExAppResult } from '@/features/exapp/components/ExAppResult';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { LayoutBody } from '@/layout/LayoutBody';
import { isJSON } from '@/utils/isJSON';
import { ExAppInvokedHistoriesLoading } from './components/ExAppInvokedHistoriesLoading';
import { useFetchExApp } from './hooks/useFetchExApp';
import { useExAppInvokeStore } from './stores/useExAppInvokeStore';
import { GovAIFormDefaultValue } from './types';

export const ExAppPage = () => {
  const { exAppResponse, requestLoading, error, clear } = useExAppInvokeStore();

  const { pathname } = useLocation();

  const params = useParams<{ teamId?: string; exAppId?: string }>();
  const teamId = params.teamId ?? '';
  const exAppId = params.exAppId ?? '';
  const {
    data: exApp,
    isLoading: isExAppLoading,
    error: exAppFetchError,
  } = useFetchExApp(teamId, exAppId);

  useEffect(() => {
    clear();
  }, [pathname, clear]);

  const uiJson = useMemo(() => {
    return exApp && isJSON(exApp.placeholder) ? JSON.parse(exApp.placeholder) : {};
  }, [exApp]);

  const defaultValuesJson = useMemo(() => {
    if (!uiJson) {
      return {};
    }

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
    isAssistant: true,
    assistantName: exApp?.exAppName ?? 'GovAI',
    loading: requestLoading,
    content: exAppResponse?.outputs ?? '',
    error: error,
  });

  const pageTitle = exApp?.exAppName ? `${exApp.exAppName} | ${APP_TITLE}` : undefined;

  return (
    <LayoutBody>
      <PageTitle title={pageTitle} />
      <div className='mx-6 max-w-[calc(1024/16*1rem)] pt-6 pb-6 lg:mx-10 lg:pb-8'>
        <div>
          {isExAppLoading && <ProgressIndicator label='AIアプリを読み込み中...' />}

          {exAppFetchError && <ErrorText>{exAppFetchError}</ErrorText>}

          {!isExAppLoading && exApp && (
            <>
              <ExAppHeader exApp={exApp} />
              <Divider className='my-6' />
              <ExAppForm exApp={exApp} uiJson={uiJson} defaultValues={defaultValuesJson} />
              <Divider className='my-6' />

              <ExAppResult
                shouldShowConversationHistory={exApp.placeholder.includes('conversation_history')}
              />

              <Divider className='my-6' />

              <div className='mb-3'>
                <h2 className='my-4 text-std-18B-160'>利用履歴</h2>
                {exApp && (
                  <ErrorBoundary resetKeys={[exApp.exAppId]} fallbackRender={ErrorFallback}>
                    <Suspense fallback={<ExAppInvokedHistoriesLoading />}>
                      <ExAppInvokedHistories exApp={exApp} />
                    </Suspense>
                  </ErrorBoundary>
                )}
              </div>
            </>
          )}
        </div>

        <div aria-live='assertive' aria-atomic='true' className='sr-only'>
          {liveStatusMessage}
        </div>
      </div>
    </LayoutBody>
  );
};
