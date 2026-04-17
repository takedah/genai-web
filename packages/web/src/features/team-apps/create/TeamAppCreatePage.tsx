import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { TeamAppCreateContent } from './components/TeamAppCreateContent';

export const TeamAppCreatePage = () => {
  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-6 pt-6 lg:mx-10'>
              <ProgressIndicator label='チームを読み込み中...' />
            </div>
          }
        >
          <TeamAppCreateContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
