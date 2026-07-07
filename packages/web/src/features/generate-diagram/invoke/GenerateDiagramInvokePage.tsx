import { useLocation } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import {
  extractDiagramCode,
  extractDiagramSentence,
} from '@/features/generate-diagram/utils/extractDiagram';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { LayoutBody } from '@/layout/LayoutBody';
import { DefaultInvokeCheckbox } from './components/DefaultInvokeCheckbox';
import { DiagramGenerateForm } from './components/DiagramGenerateForm';
import { DiagramGeneratingStep } from './components/DiagramGeneratingStep';
import { DiagramHeader } from './components/DiagramHeader';
import { DiagramResult } from './components/DiagramResult';
import { DiagramSelectionStep } from './components/DiagramSelectionStep';
import { DiagramSentence } from './components/DiagramSentence';
import { DiagramUsageCost } from './components/DiagramUsageCost';
import { useDiagram } from './hooks/useDiagram';
import { useReset } from './hooks/useReset';
import { useSetDefaultValues } from './hooks/useSetDefaultValues';

export const GenerateDiagramInvokePage = () => {
  const { pathname } = useLocation();
  const { loading, messages } = useDiagram(pathname);

  useReset();
  useSetDefaultValues();

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isAssistantMessage = lastMessage?.role === 'assistant';
  const assistantContent = isAssistantMessage ? lastMessage.content : '';
  const diagramCode = extractDiagramCode(assistantContent);
  const diagramSentence = isAssistantMessage ? extractDiagramSentence(assistantContent) : '';
  const diagramContent = lastMessage?.content ? diagramSentence : '';
  const { liveStatusMessage } = useLiveStatusMessage({
    active: isAssistantMessage,
    loading: loading,
    messages: {
      loading: 'AIが回答を生成しています...',
      loadingContinue: 'AIが引き続き回答を生成しています...',
      completed: diagramContent ? `AIの回答：${diagramContent}` : 'AIの回答がありません。',
    },
  });

  return (
    <LayoutBody>
      <PageTitle title={`ダイアグラムを生成（実行） | ${APP_TITLE}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <DiagramHeader />
        <div className='flex flex-col py-4 lg:pt-4.5 lg:pb-6'>
          <div className='pb-4'>
            <DefaultInvokeCheckbox storageKey='diagram' />
          </div>
          <DiagramGenerateForm />
          <div className='w-full'>
            <h2 className='sr-only'>出力結果</h2>
            <div className='relative mt-6 min-h-20 rounded-12 border border-solid-gray-420 p-4 lg:p-6'>
              <div className=''>
                {loading && (
                  <div className='mb-4 space-y-2'>
                    <DiagramSelectionStep />

                    <DiagramGeneratingStep />
                  </div>
                )}

                <div className='space-y-4'>
                  <DiagramSentence diagramSentence={diagramSentence} />

                  <DiagramResult diagramCode={diagramCode} />
                </div>

                {!loading && (
                  <DiagramUsageCost
                    usageCostHistory={
                      isAssistantMessage ? lastMessage?.usageCostHistory : undefined
                    }
                  />
                )}
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
