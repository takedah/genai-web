import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { Divider } from '@/components/ui/dads/Divider';
import { APP_TITLE } from '@/constants';
import { DiagramGenerateForm } from '@/features/generate-diagram/components/DiagramGenerateForm';
import { DiagramGeneratingStep } from '@/features/generate-diagram/components/DiagramGeneratingStep';
import { DiagramHeader } from '@/features/generate-diagram/components/DiagramHeader';
import { DiagramResult } from '@/features/generate-diagram/components/DiagramResult';
import { DiagramSelectionStep } from '@/features/generate-diagram/components/DiagramSelectionStep';
import { DiagramSentence } from '@/features/generate-diagram/components/DiagramSentence';
import { useDiagram } from '@/features/generate-diagram/hooks/useDiagram';
import { useReset } from '@/features/generate-diagram/hooks/useReset';
import { useSetDefaultValues } from '@/features/generate-diagram/hooks/useSetDefaultValues';
import { useDiagramStore } from '@/features/generate-diagram/stores/useDiagramStore';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { LayoutBody } from '@/layout/LayoutBody';

export const GenerateDiagramPage = () => {
  const { setDiagramCode, setDiagramSentence } = useDiagramStore();
  const { pathname } = useLocation();
  const { loading, messages } = useDiagram(pathname);

  useReset();

  // 画面遷移時に出力が残る問題の対応
  // メッセージが空の時はテキストをクリア
  useEffect(() => {
    if (messages.length === 0) {
      setDiagramCode('');
      setDiagramSentence('');
    }
  }, [messages, setDiagramCode, setDiagramSentence]);

  useSetDefaultValues();

  // description部分のみを抽出
  const getDiagramSentence = (content: string): string => {
    if (content.toLowerCase().includes('<description>')) {
      return content
        .split(/<description>/i)[1]
        .split(/<\/description>/i)[0]
        .trim();
    } else if (
      content.includes('ただいまアクセスが集中しているため時間をおいて試してみてください。')
    ) {
      return 'ただいまアクセスが集中しているため時間をおいて試してみてください。';
    } else {
      return content;
    }
  };

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') {
      return;
    }

    const currentMessage = lastMessage.content;
    if (currentMessage.toLowerCase().includes('```mermaid')) {
      const mermaidCode = currentMessage.split('```mermaid')[1].split('```')[0].trim();
      setDiagramCode(mermaidCode);
    }

    setDiagramSentence(getDiagramSentence(currentMessage));
  }, [messages, setDiagramCode, setDiagramSentence]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const { liveStatusMessage } = useLiveStatusMessage({
    isAssistant: lastMessage?.role === 'assistant',
    loading: loading,
    content: lastMessage?.content ? getDiagramSentence(lastMessage.content) : undefined,
  });

  return (
    <LayoutBody>
      <PageTitle title={`ダイアグラムを生成 | ${APP_TITLE}`} />
      <div className='mx-6 max-w-[calc(1120/16*1rem)] py-6 lg:mx-10 lg:pb-8'>
        <DiagramHeader />
        <Divider className='my-6' />
        <DiagramGenerateForm />
        <Divider className='my-3 lg:my-6' />
        <div className='w-full'>
          <h2 className='sr-only'>生成結果</h2>
          <div className='relative mt-5 min-h-20 rounded-8 border border-solid-gray-420 p-4'>
            <div className=''>
              {loading && (
                <div className='mb-4 space-y-2'>
                  <DiagramSelectionStep />

                  <DiagramGeneratingStep />
                </div>
              )}

              <div className='space-y-4'>
                <DiagramSentence />

                <DiagramResult />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div aria-live='assertive' aria-atomic='true' className='sr-only'>
        {liveStatusMessage}
      </div>
    </LayoutBody>
  );
};
