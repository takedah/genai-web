import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useDefaultInvokeSetting } from '@/hooks/useDefaultInvokeSetting';
import { LayoutBody } from '@/layout/LayoutBody';
import { GenerateTextContents } from './components/GenerateTextContents';
import { GenerateTextHeader } from './components/GenerateTextHeader';

export const GenerateTextPage = () => {
  const [isDefaultInvoke] = useDefaultInvokeSetting('generate');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDefaultInvoke && !(location.state as { fromTab?: boolean })?.fromTab) {
      navigate('/generate/invoke', { replace: true });
    }
  }, []);

  return (
    <LayoutBody>
      <PageTitle title={`文章を生成${APP_TITLE ? ` | ${APP_TITLE}` : ''}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <GenerateTextHeader />
        <GenerateTextContents />
      </div>
    </LayoutBody>
  );
};
