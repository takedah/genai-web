import { Suspense, useEffect, useId } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { useDefaultInvokeSetting } from '@/hooks/useDefaultInvokeSetting';
import { LayoutBody } from '@/layout/LayoutBody';
import { ExAppPageContent } from './components/ExAppPageContent';

export const ExAppPage = () => {
  const { teamId = '', exAppId = '' } = useParams<{ teamId: string; exAppId: string }>();
  const [isDefaultInvoke] = useDefaultInvokeSetting(`exapp_${exAppId}`);
  const location = useLocation();
  const navigate = useNavigate();
  const loadingId = useId();

  useEffect(() => {
    if (teamId === '' || exAppId === '') return;
    if (!isDefaultInvoke) return;
    if ((location.state as { fromTab?: boolean })?.fromTab) return;

    navigate(`/apps/${teamId}/${exAppId}/invoke`, { replace: true });
  }, [teamId, exAppId, isDefaultInvoke, navigate]);

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
          <ExAppPageContent />
        </Suspense>
      </ErrorBoundary>
    </LayoutBody>
  );
};
