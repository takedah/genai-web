import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { Divider } from '@/components/ui/dads/Divider';
import { APP_TITLE } from '@/constants';
import { GenerateTextForm } from '@/features/generate-text/components/GenerateTextForm';
import { GenerateTextHeader } from '@/features/generate-text/components/GenerateTextHeader';
import { GenerateTextResult } from '@/features/generate-text/components/GenerateTextResult';
import { useChat } from '@/hooks/useChat';
import { useFollow } from '@/hooks/useFollow';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { usePrompter } from '@/hooks/usePrompter';
import { useTyping } from '@/hooks/useTyping';
import { LayoutBody } from '@/layout/LayoutBody';
import { useReset } from './hooks/useReset';
import { useSetDefaultValues } from './hooks/useSetDefaultValues';
import { useGenerateTextStore } from './stores/useGenerateTextStore';

export const GenerateTextPage = () => {
  const { text, setText } = useGenerateTextStore();

  const { pathname } = useLocation();
  const { loading, messages, postChat, updateSystemContextByModel } = useChat(pathname);

  const { typingTextOutput } = useTyping(loading, text);
  const { scrollableContainer, setFollowing } = useFollow();

  const { prompter } = usePrompter();

  useReset();

  // 画面遷移時に出力が残る問題の対応
  // メッセージが空の時はテキストをクリア
  useEffect(() => {
    if (messages.length === 0) {
      setText('');
    }
  }, [messages, setText]);

  useEffect(() => {
    updateSystemContextByModel();
  }, [prompter]);

  useSetDefaultValues();

  const getGeneratedText = (information: string, context: string) => {
    postChat(
      prompter.generateTextPrompt({
        information,
        context,
      }),
      true,
    );
  };

  // リアルタイムにレスポンスを表示
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') {
      return;
    }

    const response = messages[messages.length - 1].content;
    setText(response.trim());
  }, [messages]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const { liveStatusMessage } = useLiveStatusMessage({
    isAssistant: lastMessage?.role === 'assistant',
    loading: loading,
    content: lastMessage?.content,
  });

  return (
    <LayoutBody>
      <PageTitle title={`文章を生成 | ${APP_TITLE}`} />
      <div className='mx-6 max-w-[calc(1024/16*1rem)] py-6 lg:mx-10 lg:pb-8'>
        <GenerateTextHeader />
        <Divider className='my-6' />
        <GenerateTextForm setFollowing={setFollowing} getGeneratedText={getGeneratedText} />
        <Divider className='my-3 lg:my-6' />
        <GenerateTextResult
          scrollableContainer={scrollableContainer}
          typingTextOutput={typingTextOutput}
        />
      </div>
      <div aria-live='assertive' aria-atomic='true' className='sr-only'>
        {liveStatusMessage}
      </div>
    </LayoutBody>
  );
};
