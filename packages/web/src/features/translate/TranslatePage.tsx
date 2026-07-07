import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useDefaultInvokeSetting } from '@/hooks/useDefaultInvokeSetting';
import { LayoutBody } from '@/layout/LayoutBody';
import { TranslateContents } from './components/TranslateContents';
import { TranslateHeader } from './components/TranslateHeader';

export const TranslatePage = () => {
  const [isDefaultInvoke] = useDefaultInvokeSetting('translate');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDefaultInvoke && !(location.state as { fromTab?: boolean })?.fromTab) {
      navigate('/translate/invoke', { replace: true });
    }
  }, []);

  return (
    <LayoutBody>
      <PageTitle title={`翻訳${APP_TITLE ? ` | ${APP_TITLE}` : ''}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <TranslateHeader />
        <TranslateContents />
      </div>
    </LayoutBody>
  );
};
