import type { UsageCostEntry } from 'genai-web';
import { Ref, useRef } from 'react';
import { useLocation } from 'react-router';
import { Markdown } from '@/components/Markdown';
import { ButtonCopy } from '@/components/ui/ButtonCopy';
import { Button } from '@/components/ui/dads/Button';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { useChat } from '@/hooks/useChat';
import { GenerateTextUsageCost } from './GenerateTextUsageCost';

type Props = {
  scrollableContainer: Ref<HTMLDivElement>;
  typingTextOutput: string;
  text: string;
  usageCostHistory?: UsageCostEntry[];
};

export const GenerateTextResult = (props: Props) => {
  const { scrollableContainer, typingTextOutput, text, usageCostHistory } = props;

  const copyTextRef = useRef<HTMLDivElement>(null);

  const { pathname } = useLocation();
  const { loading, continueGeneration, getStopReason } = useChat(pathname);

  const stopReason = getStopReason();
  const isInitial = !loading && text === '';
  const showResult = !loading && text !== '';

  return (
    <div
      ref={scrollableContainer}
      className='relative mt-6 rounded-12 border border-solid-gray-420 p-4 lg:p-6'
    >
      <h2 className='sr-only'>出力結果</h2>

      {isInitial && (
        <div className='leading-175 text-solid-gray-536'>生成された文章がここに表示されます</div>
      )}

      <div ref={copyTextRef}>
        <Markdown>{typingTextOutput}</Markdown>
      </div>

      {loading && (
        <ProgressIndicator className='my-0.5' type='inlined' aria-label='読み込み中'>
          <ProgressIndicatorSpinner size='sm' />
        </ProgressIndicator>
      )}

      {stopReason === 'max_tokens' && (
        <div className='mt-4'>
          <Button variant='outline' size='md' onClick={() => continueGeneration()}>
            続きを出力
          </Button>
        </div>
      )}

      {showResult && (
        <>
          <GenerateTextUsageCost usageCostHistory={usageCostHistory} />
          <div className='mt-2 -mb-2 flex w-full justify-end'>
            <ButtonCopy
              text={text}
              targetRef={copyTextRef}
              label='出力結果をコピー'
              copiedLabel='コピー完了'
              className='min-w-[calc(184/16*1rem)]'
            />
          </div>
        </>
      )}
    </div>
  );
};
