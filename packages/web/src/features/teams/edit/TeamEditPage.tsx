import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { TeamEditContent } from './components/TeamEditContent';

export const TeamEditPage = () => {
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
          <TeamEditContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
