import { useLocation } from 'react-router';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { useChat } from '@/hooks/useChat';
import { isSubmitKey } from '@/utils/keyboard';
import { SendButton } from './SendButton';

type Props = {
  textareaId: string;
  content: string;
  placeholder?: string;
  loading?: boolean;
  'aria-labelledby'?: string;
  onChangeContent: (content: string) => void;
  onSend: () => void;
};

export const GenerateImageInput = (props: Props) => {
  const { textareaId, content, placeholder, onChangeContent, onSend } = props;

  const { pathname } = useLocation();
  const { loading: chatLoading } = useChat(pathname);

  const loading = props.loading === undefined ? chatLoading : props.loading;

  const disabledSend = content.trim() === '';

  return (
    <div className={`w-full px-6 py-4`}>
      <div className='relative flex items-end bg-white'>
        <div className='flex w-full flex-col-reverse'>
          <div className='relative flex flex-col'>
            <AutoResizeTextarea
              id={textareaId}
              className={`resize-none pr-14`}
              placeholder={placeholder ?? '入力してください'}
              value={content}
              aria-labelledby={props['aria-labelledby']}
              onChange={(e) => onChangeContent(e.target.value)}
              onKeyDown={(e) => {
                if (isSubmitKey(e) && !disabledSend) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />

            <div>
              <SendButton
                className='absolute! right-2 bottom-[calc(7/16*1rem)]'
                disabled={disabledSend}
                loading={loading}
                onClick={onSend}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
