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
import { TeamMemberEditContent } from './components/TeamMemberEditContent';

export const TeamMemberEditPage = () => {
  const { teamId, userId } = useParams();
  const loadingId = useId();

  useEffect(() => {
    if (teamId) {
      preload(`/teams/${teamId}`, teamApiFetcher);
    }
    if (teamId && userId) {
      preload(`/teams/${teamId}/users/${userId}`, teamApiFetcher);
    }
  }, [teamId, userId]);

  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
              <ProgressIndicator type='inlined' aria-labelledby={loadingId}>
                <ProgressIndicatorSpinner size='sm' />
                <span id={loadingId}>チームメンバーを読み込み中...</span>
              </ProgressIndicator>
            </div>
          }
        >
          <TeamMemberEditContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
