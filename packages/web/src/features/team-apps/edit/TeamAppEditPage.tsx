import { Suspense, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { preload } from 'swr';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { teamApiFetcher } from '@/lib/fetcher';
import { TeamAppEditContent } from './components/TeamAppEditContent';

export const TeamAppEditPage = () => {
  const { teamId, appId } = useParams();

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
            <div className='mx-6 pt-6 lg:mx-10'>
              <ProgressIndicator label='AIアプリ情報を読み込み中...' />
            </div>
          }
        >
          <TeamAppEditContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
