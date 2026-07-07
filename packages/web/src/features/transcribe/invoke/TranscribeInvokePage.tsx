import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useFollow } from '@/hooks/useFollow';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { LayoutBody } from '@/layout/LayoutBody';
import { DefaultInvokeCheckbox } from './components/DefaultInvokeCheckbox';
import { SendToUseCaseButton } from './components/SendToUseCaseButton';
import { TranscribeForm } from './components/TranscribeForm';
import { TranscribeHeader } from './components/TranscribeHeader';
import { TranscribeResult } from './components/TranscribeResult';
import { UseCaseSelectionModal } from './components/UseCaseSelectionModal';
import { useTranscribe } from './hooks/useTranscribe';
import { useTranscribeStore } from './stores/useTranscribeStore';

export const TranscribeInvokePage = () => {
  const { transcriptData, loading } = useTranscribe();

  const { speakers } = useTranscribeStore();

  const { scrollableContainer, setFollowing } = useFollow();

  const transcripts = transcriptData?.transcripts ?? [];

  const speakerMapping = Object.fromEntries(
    speakers.split(',').map((speaker, idx) => [`spk_${idx}`, speaker.trim()]),
  );

  const formattedOutput = transcripts
    .map((item) =>
      item.speakerLabel
        ? `${speakerMapping[item.speakerLabel] || item.speakerLabel}: ${item.transcript}`
        : item.transcript,
    )
    .join('\n');

  const { liveStatusMessage } = useLiveStatusMessage({
    active: true,
    loading: loading,
    messages: {
      loading: 'AIが音声認識を実行しています...',
      loadingContinue: 'AIが引き続き音声認識を実行しています...',
      completed: '音声認識が完了しました。音声認識結果をご確認ください。',
    },
  });

  return (
    <LayoutBody>
      <PageTitle title={`音声ファイルから文字起こし（実行） | ${APP_TITLE}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <TranscribeHeader />

        <div className='flex flex-col py-4 lg:pt-4.5 lg:pb-6'>
          <div className='pb-4'>
            <DefaultInvokeCheckbox storageKey='transcribe' />
          </div>
          <TranscribeForm setFollowing={setFollowing} />
          <TranscribeResult
            scrollableContainer={scrollableContainer}
            transcripts={transcripts}
            formattedOutput={formattedOutput}
            speakerMapping={speakerMapping}
          />

          {formattedOutput !== '' && (
            <>
              <div className='mt-4 flex flex-col items-end'>
                <SendToUseCaseButton formattedOutput={formattedOutput} />
              </div>

              <UseCaseSelectionModal formattedOutput={formattedOutput} />
            </>
          )}
        </div>
      </div>
      <div aria-live='assertive' aria-atomic='true' className='sr-only'>
        {liveStatusMessage}
      </div>
    </LayoutBody>
  );
};
