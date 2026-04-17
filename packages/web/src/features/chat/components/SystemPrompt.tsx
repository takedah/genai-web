import { useLocation, useParams } from 'react-router';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { Button } from '@/components/ui/dads/Button';
import { Disclosure, DisclosureSummary } from '@/components/ui/dads/Disclosure';
import { SupportText } from '@/components/ui/dads/SupportText';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useChat } from '@/hooks/useChat';

type Props = {
  currentSystemContext: string;
  setShowSystemContextDialog: (show: boolean) => void;
  setShowPromptListDialog: (show: boolean) => void;
};

export const SystemPrompt = (props: Props) => {
  const { currentSystemContext, setShowSystemContextDialog, setShowPromptListDialog } = props;

  const { pathname } = useLocation();
  const { chatId } = useParams();

  const { loadingMessages, isEmpty } = useChat(pathname, chatId);

  const { inputSystemContext, setInputSystemContext, setSaveSystemContext } = useChatStore();

  const canEdit = isEmpty && !chatId;
  const isNewChat = !loadingMessages && canEdit;
  const isCurrentChat = !loadingMessages && !canEdit;

  return (
    <div className='mt-3'>
      <Disclosure className='relative'>
        <DisclosureSummary id='system-prompt-input-label' className='font-700'>
          システムプロンプト
        </DisclosureSummary>
        <div>
          {loadingMessages && <p>システムプロンプトを読み込み中...</p>}

          {isNewChat && (
            <div className='py-3'>
              <div className='relative flex flex-col'>
                <AutoResizeTextarea
                  id='system-prompt-input'
                  className='resize-none'
                  placeholder='システムプロンプトを入力'
                  value={inputSystemContext}
                  aria-labelledby='system-prompt-input-label'
                  onChange={(e) => {
                    setInputSystemContext(e.target.value);
                  }}
                />
              </div>
              <div className='absolute top-0.5 right-2 flex justify-start gap-x-2'>
                <Button
                  variant='outline'
                  size='xs'
                  aria-haspopup='dialog'
                  onClick={() => setShowPromptListDialog(true)}
                >
                  プロンプト一覧から選択
                </Button>
                <Button
                  variant='outline'
                  size='xs'
                  aria-haspopup='dialog'
                  onClick={() => {
                    setSaveSystemContext(inputSystemContext);
                    setShowSystemContextDialog(true);
                  }}
                >
                  このプロンプトを保存
                </Button>
              </div>
            </div>
          )}

          {isCurrentChat && (
            <div className='pt-2 pb-3'>
              <div className='flex flex-col gap-2'>
                <SupportText id='system-prompt-input-support' className='text-dns-14N-130!'>
                  会話を開始したチャットのシステムプロンプトは編集できません
                </SupportText>
                <AutoResizeTextarea
                  id='current-system-prompt-input'
                  className='resize-none pr-20'
                  value={currentSystemContext}
                  aria-labelledby='system-prompt-input-label'
                  aria-describedby='system-prompt-input-support'
                  readOnly
                />
              </div>
              <div className='absolute top-6 right-2 flex flex-row-reverse justify-start gap-x-2'>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() => {
                    setSaveSystemContext(currentSystemContext);
                    setShowSystemContextDialog(true);
                  }}
                >
                  このプロンプトを保存
                </Button>
              </div>
            </div>
          )}
        </div>
      </Disclosure>
    </div>
  );
};
