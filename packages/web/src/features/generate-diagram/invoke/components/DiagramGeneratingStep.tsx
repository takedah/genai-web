import { useId } from 'react';
import { useLocation } from 'react-router';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { useDiagram } from '../hooks/useDiagram';

export const DiagramGeneratingStep = () => {
  const loadingId = useId();
  const { pathname } = useLocation();
  const { diagramType } = useDiagram(pathname);

  if (diagramType === '') {
    return null;
  }

  return (
    <div className='flex min-h-10 items-center justify-center rounded-6 bg-solid-gray-50 p-3'>
      <ProgressIndicator type='inlined' aria-labelledby={loadingId}>
        <ProgressIndicatorSpinner size='sm' />
        <span id={loadingId}>ステップ２: 図を生成しています</span>
      </ProgressIndicator>
    </div>
  );
};
