import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { DiagramHeader } from '@/features/generate-diagram/components/DiagramHeader';
import { useDefaultInvokeSetting } from '@/hooks/useDefaultInvokeSetting';
import { LayoutBody } from '@/layout/LayoutBody';
import { DiagramContents } from './components/DiagramContents';

export const GenerateDiagramPage = () => {
  const [isDefaultInvoke] = useDefaultInvokeSetting('diagram');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDefaultInvoke && !(location.state as { fromTab?: boolean })?.fromTab) {
      navigate('/diagram/invoke', { replace: true });
    }
  }, []);

  return (
    <LayoutBody>
      <PageTitle title={`ダイアグラムを生成${APP_TITLE ? ` | ${APP_TITLE}` : ''}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <DiagramHeader />
        <DiagramContents />
      </div>
    </LayoutBody>
  );
};
