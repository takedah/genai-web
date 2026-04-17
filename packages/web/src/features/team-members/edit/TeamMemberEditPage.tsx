import { Suspense, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { preload } from 'swr';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { teamApiFetcher } from '@/lib/fetcher';
import { TeamMemberEditContent } from './components/TeamMemberEditContent';

export const TeamMemberEditPage = () => {
  const { teamId, userId } = useParams();

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
            <div className='mx-6 pt-6 lg:mx-10'>
              <ProgressIndicator label='チームメンバーを読み込み中...' />
            </div>
          }
        >
          <TeamMemberEditContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
