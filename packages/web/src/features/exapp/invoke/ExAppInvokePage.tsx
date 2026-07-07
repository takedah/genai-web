import { Suspense, useEffect, useId } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { preload } from 'swr';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { teamApiFetcher } from '@/lib/fetcher';
import { ExAppInvokePageContent } from './components/ExAppInvokePageContent';

export const ExAppInvokePage = () => {
  const loadingId = useId();
  const { teamId = '', exAppId = '' } = useParams<{ teamId: string; exAppId: string }>();

  useEffect(() => {
    if (!teamId || !exAppId) return;
    preload(`/teams/${teamId}/exapps/${exAppId}`, teamApiFetcher);
    preload(
      `exapps/histories?${new URLSearchParams({ teamId, exAppId }).toString()}`,
      teamApiFetcher,
    );
  }, [teamId, exAppId]);

  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
              <ProgressIndicator type='inlined' aria-labelledby={loadingId}>
                <ProgressIndicatorSpinner size='sm' />
                <span id={loadingId}>AIアプリを読み込み中...</span>
              </ProgressIndicator>
            </div>
          }
        >
          <ExAppInvokePageContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
