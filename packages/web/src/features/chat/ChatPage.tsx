import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { ScrollBottomButton } from '@/components/ui/ScrollBottomButton';
import { APP_TITLE } from '@/constants';
import { ChatMessage } from '@/features/chat/components/ChatMessage';
import { ChatNotificationBanner } from '@/features/chat/components/ChatNotificationBanner';
import { DialogPromptList } from '@/features/chat/components/DialogPromptList';
import { DialogSaveSystemContext } from '@/features/chat/components/DialogSaveSystemContext';
import { FileDrop } from '@/features/chat/components/FileDrop';
import { MessageInputSection } from '@/features/chat/components/MessageInputSection';
import { ModelSelector } from '@/features/chat/components/ModelSelector';
import { SystemPrompt } from '@/features/chat/components/SystemPrompt';
import { Title } from '@/features/chat/components/Title';
import { useChatTitle } from '@/features/chat/hooks/useChatTitle';
import { useFileUploadable } from '@/features/chat/hooks/useFileUploadable';
import { useReset } from '@/features/chat/hooks/useReset';
import { useSetDefaultValues } from '@/features/chat/hooks/useSetDefaultValues';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useChat } from '@/hooks/useChat';
import { useFiles } from '@/hooks/useFiles';
import { useFollow } from '@/hooks/useFollow';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { usePrompter } from '@/hooks/usePrompter';
import { useScreen } from '@/hooks/useScreen';
import { useSystemContext } from './hooks/useSystemContext';
import { ChatPageQueryParams } from './types';

export const ChatPage = () => {
  const {
    content,
    setContent,
    saveSystemContext,
    inputSystemContext,
    setInputSystemContext,
    setIsDragOver,
    shouldAutoSubmit,
    setShouldAutoSubmit,
  } = useChatStore();

  const { pathname, search } = useLocation();
  const { clear: clearFiles, uploadedFiles, base64Cache } = useFiles(pathname);
  const { chatId } = useParams();
  const { screen, scrollTopAnchorRef, scrollBottomAnchorRef } = useScreen();

  const [showSystemContextDialog, setShowSystemContextDialog] = useState(false);
  const [showPromptListDialog, setShowPromptListDialog] = useState(false);
  const { systemContextList, onSaveSystemContext, onDeleteSystemContext, onUpdateSystemContext } =
    useSystemContext();

  const {
    loading,
    loadingMessages,
    isEmpty,
    messages,
    clear,
    postChat,
    updateSystemContext,
    getCurrentSystemContext,
    retryGeneration,
  } = useChat(pathname, chatId);

  const { scrollableContainer, setFollowing } = useFollow();
  const { prompter } = usePrompter();

  useReset();

  // 画面遷移時に出力が残る問題の対応
  // メッセージが空の時はテキストをクリア（自動送信時・クエリパラメータ指定時は除く）
  useEffect(() => {
    if (messages.length === 0 && !shouldAutoSubmit && search === '') {
      setContent('');
    }
  }, [messages, setContent, shouldAutoSubmit, search]);

  const { title } = useChatTitle();

  const { accept, fileUploadable } = useFileUploadable();

  useSetDefaultValues();

  const currentSystemContext = getCurrentSystemContext();

  const onSend = useCallback(() => {
    if (inputSystemContext !== currentSystemContext) {
      updateSystemContext(inputSystemContext);
    }
    setFollowing(true);
    postChat(prompter.chatPrompt({ content }), {
      uploadedFiles: fileUploadable ? uploadedFiles : undefined,
      base64Cache,
    });
    setContent('');
    clearFiles();
  }, [
    content,
    base64Cache,
    fileUploadable,
    setFollowing,
    inputSystemContext,
    updateSystemContext,
    currentSystemContext,
    prompter,
    postChat,
    uploadedFiles,
    setContent,
    clearFiles,
  ]);

  useEffect(() => {
    if (shouldAutoSubmit && content && inputSystemContext && !loading) {
      onSend();
      setShouldAutoSubmit(false);
    }
  }, [shouldAutoSubmit, content, inputSystemContext, loading, onSend, setShouldAutoSubmit]);

  const onRetry = () => {
    retryGeneration({ base64Cache });
  };

  const onReset = () => {
    clear();
    setContent('');
  };

  useEffect(() => {
    // URLにクエリパラメータがある場合は useSetDefaultValues に任せる
    if (search !== '') {
      return;
    }
    setInputSystemContext(currentSystemContext);
  }, [currentSystemContext, setInputSystemContext, search]);

  const onClickSamplePrompt = (params: ChatPageQueryParams) => {
    setContent(params.content ?? '');
    updateSystemContext(params.systemContext ?? '');
  };

  const handleDragOver = (event: React.DragEvent) => {
    // ファイルドラッグ時にオーバーレイを表示
    event.preventDefault();
    setIsDragOver(true);
  };

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // トップチャットからの初回遷移時のみアナウンスを遅らせる
  // （ページタイトル読み上げに約2-3秒かかるため、競合を避ける）
  const isFromTopChat = search.includes('autoSubmit=true');
  const hasCompletedFirstLoadRef = useRef(false);
  const isInitialFromTopChat = isFromTopChat && !hasCompletedFirstLoadRef.current;

  // 初回ローディング完了時にフラグを立てる（ローディング中は遅延を維持）
  useEffect(() => {
    if (!loading && isFromTopChat && !hasCompletedFirstLoadRef.current && !isEmpty) {
      hasCompletedFirstLoadRef.current = true;
    }
  }, [loading, isFromTopChat, isEmpty]);

  const START_DELAY_MS = 3000;

  const { liveStatusMessage } = useLiveStatusMessage({
    isAssistant: lastMessage?.role === 'assistant' || loading,
    loading: loading,
    content: lastMessage?.content,
    startDelay: isInitialFromTopChat ? START_DELAY_MS : 0,
  });

  return (
    <>
      <PageTitle title={`${title} | ${APP_TITLE}`} />
      <div className='h-full'>
        <div onDragOver={fileUploadable ? handleDragOver : undefined} className='relative'>
          <div className='grid h-[calc(100vh-var(--header-height))] grid-rows-[auto_1fr_auto]'>
            <div className='min-w-0 border-b border-b-black px-4 pt-4 pb-2 lg:px-6'>
              <Title title={title} />

              <FileDrop fileUpload={fileUploadable} accept={accept} />

              <ModelSelector />

              <SystemPrompt
                currentSystemContext={currentSystemContext}
                setShowSystemContextDialog={setShowSystemContextDialog}
                setShowPromptListDialog={setShowPromptListDialog}
              />
            </div>

            <div className='overflow-x-clip overflow-y-auto [scrollbar-gutter:stable]' ref={screen}>
              <div ref={scrollTopAnchorRef} />

              {isEmpty && !loadingMessages && (
                <div className='relative grid min-h-full w-full place-content-center px-8 py-4'>
                  <ChatNotificationBanner />
                </div>
              )}

              {loadingMessages && (
                <div className='relative grid h-full w-full place-content-center'>
                  <ProgressIndicator isLarge={true} label='読み込み中...' />
                </div>
              )}

              <div ref={scrollableContainer}>
                {!isEmpty &&
                  messages.map((chat, idx) => (
                    <ChatMessage
                      key={chat.messageId ?? `message-${idx}`}
                      chatContent={chat}
                      loading={loading && idx === messages.length - 1}
                      allowRetry={idx === messages.length - 1}
                      retryGeneration={onRetry}
                    />
                  ))}
              </div>

              {!isEmpty && (
                <div className='fixed right-4 bottom-28 z-0 lg:right-8'>
                  <ScrollBottomButton />
                </div>
              )}

              <div ref={scrollBottomAnchorRef} />
            </div>

            <MessageInputSection
              onSend={onSend}
              onReset={onReset}
              fileUpload={fileUploadable}
              accept={accept}
            />
          </div>
        </div>
      </div>

      <div aria-live='assertive' aria-atomic='true' className='sr-only'>
        {liveStatusMessage}
      </div>

      <DialogSaveSystemContext
        isOpen={showSystemContextDialog}
        systemContext={saveSystemContext}
        onClose={() => setShowSystemContextDialog(false)}
        onSave={onSaveSystemContext}
      />

      <DialogPromptList
        isOpen={showPromptListDialog}
        onClick={onClickSamplePrompt}
        systemContextList={systemContextList}
        onClickDeleteSystemContext={onDeleteSystemContext}
        onClickUpdateSystemContext={onUpdateSystemContext}
        onClose={() => setShowPromptListDialog(false)}
      />
    </>
  );
};
