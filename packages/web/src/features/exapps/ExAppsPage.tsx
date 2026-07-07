import { Suspense, useId } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { ExAppsContent } from './components/ExAppsContent';

export const ExAppsPage = () => {
  const loadingId = useId();
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
          <ExAppsContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
