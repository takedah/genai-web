import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useDefaultInvokeSetting } from '@/hooks/useDefaultInvokeSetting';
import { LayoutBody } from '@/layout/LayoutBody';
import { TranscribeContents } from './components/TranscribeContents';
import { TranscribeHeader } from './components/TranscribeHeader';

export const TranscribePage = () => {
  const [isDefaultInvoke] = useDefaultInvokeSetting('transcribe');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDefaultInvoke && !(location.state as { fromTab?: boolean })?.fromTab) {
      navigate('/transcribe/invoke', { replace: true });
    }
  }, []);

  return (
    <LayoutBody>
      <PageTitle title={`音声ファイルから文字起こし${APP_TITLE ? ` | ${APP_TITLE}` : ''}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <TranscribeHeader />
        <TranscribeContents />
      </div>
    </LayoutBody>
  );
};
