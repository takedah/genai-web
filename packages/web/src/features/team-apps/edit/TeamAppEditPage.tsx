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
import { TeamAppEditContent } from './components/TeamAppEditContent';

export const TeamAppEditPage = () => {
  const { teamId, appId } = useParams();
  const loadingId = useId();

  useEffect(() => {
    if (teamId) {
      preload(`/teams/${teamId}`, teamApiFetcher);
    }
    if (teamId && appId) {
      preload(`/teams/${teamId}/exapps/${appId}`, teamApiFetcher);
    }
  }, [teamId, appId]);

  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
              <ProgressIndicator type='inlined' aria-labelledby={loadingId}>
                <ProgressIndicatorSpinner size='sm' />
                <span id={loadingId}>AIアプリ情報を読み込み中...</span>
              </ProgressIndicator>
            </div>
          }
        >
          <TeamAppEditContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
