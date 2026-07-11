import { Suspense, useId } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { TeamAppCreateContent } from './components/TeamAppCreateContent';

export const TeamAppCreatePage = () => {
  const loadingId = useId();
  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
              <ProgressIndicator type='inlined' aria-labelledby={loadingId}>
                <ProgressIndicatorSpinner size='sm' />
                <span id={loadingId}>チームを読み込み中...</span>
              </ProgressIndicator>
            </div>
          }
        >
          <TeamAppCreateContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
