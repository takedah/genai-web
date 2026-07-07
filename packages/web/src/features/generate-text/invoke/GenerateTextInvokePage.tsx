import { useLocation } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useChat } from '@/hooks/useChat';
import { useFollow } from '@/hooks/useFollow';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { usePrompter } from '@/hooks/usePrompter';
import { isRecentlyUsedAppsEnabled, useRecordRecentlyUsedApp } from '@/hooks/useRecentlyUsedApps';
import { useResolveAppPath } from '@/hooks/useResolveAppPath';
import { useTyping } from '@/hooks/useTyping';
import { LayoutBody } from '@/layout/LayoutBody';
import { GENU_APP_METAS } from '@/utils/getAvailableGenuApps';
import { DefaultInvokeCheckbox } from './components/DefaultInvokeCheckbox';
import { GenerateTextForm } from './components/GenerateTextForm';
import { GenerateTextHeader } from './components/GenerateTextHeader';
import { GenerateTextResult } from './components/GenerateTextResult';
import { useReset } from './hooks/useReset';
import { useSetDefaultValues } from './hooks/useSetDefaultValues';

export const GenerateTextInvokePage = () => {
  const { pathname } = useLocation();
  const { loading, messages, postChat } = useChat(pathname);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const text = lastMessage?.role === 'assistant' ? lastMessage.content.trim() : '';

  const { typingTextOutput } = useTyping(loading, text);
  const { scrollableContainer, setFollowing } = useFollow();

  const { prompter } = usePrompter();
  const recordRecentlyUsedApp = useRecordRecentlyUsedApp();
  const { resolveGenUAppPath } = useResolveAppPath();

  useReset();

  useSetDefaultValues();

  const getGeneratedText = async (information: string, context: string) => {
    await postChat(
      prompter.generateTextPrompt({
        information,
        context,
      }),
      { ignoreHistory: true },
    );
    if (isRecentlyUsedAppsEnabled) {
      const meta = GENU_APP_METAS.generate;
      recordRecentlyUsedApp({
        kind: 'genu',
        genuKind: 'generate',
        title: meta.label,
        path: resolveGenUAppPath('generate'),
      });
    }
  };

  const { liveStatusMessage } = useLiveStatusMessage({
    active: lastMessage?.role === 'assistant',
    loading: loading,
    messages: {
      loading: 'AIが回答を生成しています...',
      loadingContinue: 'AIが引き続き回答を生成しています...',
      completed: lastMessage?.content
        ? `AIの回答：${lastMessage.content}`
        : 'AIの回答がありません。',
    },
  });

  return (
    <LayoutBody>
      <PageTitle title={`文章を生成（実行） | ${APP_TITLE}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <GenerateTextHeader />
        <div className='flex flex-col py-4 lg:pt-4.5 lg:pb-6'>
          <div className='pb-4'>
            <DefaultInvokeCheckbox storageKey='generate' />
          </div>
          <GenerateTextForm setFollowing={setFollowing} getGeneratedText={getGeneratedText} />
          <GenerateTextResult
            scrollableContainer={scrollableContainer}
            typingTextOutput={typingTextOutput}
            text={text}
            usageCostHistory={
              lastMessage?.role === 'assistant' ? lastMessage.usageCostHistory : undefined
            }
          />
        </div>
      </div>
      <div aria-live='assertive' aria-atomic='true' className='sr-only'>
        {liveStatusMessage}
      </div>
    </LayoutBody>
  );
};
