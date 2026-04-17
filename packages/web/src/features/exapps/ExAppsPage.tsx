import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { LayoutBody } from '@/layout/LayoutBody';
import { ExAppsContent } from './components/ExAppsContent';

export const ExAppsPage = () => {
  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-6 py-6 lg:mx-10 lg:pb-8'>
              <ProgressIndicator label='AIアプリを読み込み中...' />
            </div>
          }
        >
          <ExAppsContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
