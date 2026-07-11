import { ExApp } from 'genai-web';
import { useState } from 'react';
import { UpdateIcon } from '@/components/ui/icons/UpdateIcon';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { useAccessibilityAnnouncer } from '@/hooks/useAccessibilityAnnouncer';
import { useExAppInvokedHistories } from '../hooks/useExAppInvokedHistories';

type Props = {
  exApp: ExApp;
};

export const ExAppInvokedHistoriesRefreshButton = ({ exApp }: Props) => {
  const { isValidating, isLoadingMore, mutate } = useExAppInvokedHistories(
    exApp.teamId,
    exApp.exAppId,
  );

  const { announceMessage, announce, clearAnnounce } = useAccessibilityAnnouncer();
  const [announcerKey, setAnnouncerKey] = useState(0);

  const isRefreshing = isValidating && !isLoadingMore;

  const handleRefresh = async () => {
    try {
      await mutate();
    } catch (error) {
      // 未処理の Promise rejection を防ぐ。失敗時は完了アナウンスを行わない
      console.error('Failed to refresh ExApp histories', error);
      return;
    }
    // 前回と同じ文言でもライブリージョンの変化を検知させるため、
    // 一度クリアした上で要素を作り直し（空でマウント）、その後メッセージを注入する
    clearAnnounce();
    setAnnouncerKey((key) => key + 1);
    announce('利用履歴を最新の状態に更新しました');
  };

  return (
    <div className='mt-1.5 mb-2'>
      <LoadingButton
        loading={isRefreshing}
        onClick={handleRefresh}
        variant='outline'
        size='sm'
        type='button'
        className='gap-1.5 w-fit'
      >
        {!isRefreshing && <UpdateIcon aria-hidden={true} />}
        {isRefreshing ? '更新中...' : '最新の状態に更新'}
      </LoadingButton>

      <div key={announcerKey} role='status' className='sr-only'>
        {announceMessage}
      </div>
    </div>
  );
};
