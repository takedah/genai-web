import { ExApp } from 'genai-web';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { ExAppInvokedHistories } from './ExAppInvokedHistories';
import { ExAppInvokedHistoriesLoading } from './ExAppInvokedHistoriesLoading';

type Props = {
  exApp: ExApp;
  currentCreatedDate?: string;
};

export const ExAppHistorySidebar = ({ exApp, currentCreatedDate }: Props) => {
  return (
    <nav
      className='grid grid-cols-1 grid-rows-[auto_auto_1fr_auto] gap-1 min-h-0'
      aria-labelledby='side-exapp-history-heading'
    >
      <h2 id='side-exapp-history-heading' className='text-std-20B-150'>
        このアプリの利用履歴
      </h2>
      <ErrorBoundary resetKeys={[exApp.exAppId]} fallbackRender={ErrorFallback}>
        <Suspense fallback={<ExAppInvokedHistoriesLoading />}>
          <ExAppInvokedHistories exApp={exApp} currentCreatedDate={currentCreatedDate} />
        </Suspense>
      </ErrorBoundary>
    </nav>
  );
};
