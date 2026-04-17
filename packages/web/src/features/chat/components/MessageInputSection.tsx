import { useLocation, useParams } from 'react-router';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useChat } from '@/hooks/useChat';
import { submitModifierLabel } from '@/utils/keyboard';
import { FILE_LIMIT } from '../constants';
import { InputChatContent } from './InputChatContent';

type Props = {
  onSend: () => void;
  onReset: () => void;
  fileUpload: boolean;
  accept: string[];
};

export const MessageInputSection = (props: Props) => {
  const { onSend, onReset, fileUpload, accept } = props;

  const { chatId } = useParams();
  const { pathname } = useLocation();
  const { content, setContent } = useChatStore();

  const { loading } = useChat(pathname, chatId);

  return (
    <section
      aria-labelledby='chat-input-heading'
      className='relative flex flex-col items-center justify-center border-t border-t-solid-gray-420 bg-white print:hidden'
    >
      <h2 id='chat-input-heading' className='sr-only'>
        メッセージ入力
      </h2>
      <InputChatContent
        textareaId='chat-input'
        aria-labelledby='chat-input-heading'
        content={content}
        disabled={loading}
        onChangeContent={setContent}
        resetDisabled={!!chatId}
        onSend={() => {
          onSend();
        }}
        placeholder={`メッセージを入力（Enterで改行、${submitModifierLabel}+Enterで送信します）`}
        onReset={onReset}
        fileUpload={fileUpload}
        fileLimit={FILE_LIMIT}
        accept={accept}
      />
    </section>
  );
};
