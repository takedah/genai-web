import { InvokeExAppHistory } from 'genai-web';
import { Disclosure, DisclosureSummary } from '@/components/ui/dads/Disclosure';
import { Ul } from '@/components/ui/dads/Ul';
import { ConversationHistory, FileInputItem, GovAIFormUIJson } from '../../types';
import { formatConversationHistory } from '../utils/formatConversationHistory';

type Props = {
  inputs: InvokeExAppHistory['inputs'];
  systemPromptKey: string;
  uiJson?: GovAIFormUIJson;
};

const isFileInputItems = (value: unknown): value is FileInputItem[] =>
  Array.isArray(value) && value.length > 0 && 'files' in value[0];

const getFilesInfo = (files: FileInputItem[], uiJson?: GovAIFormUIJson) => {
  return files
    .map((item) => {
      const filenames = item.files.map((file) => file.filename).join(', ');
      const config = item.key ? uiJson?.[item.key] : undefined;
      const label = config && 'title' in config ? config.title : undefined;
      return label ? `${label}: ${filenames}` : filenames;
    })
    .join(', ');
};

export const ExAppHistoryInputs = ({ inputs, systemPromptKey, uiJson }: Props) => {
  const getLabel = (key: string) => {
    const config = uiJson?.[key];
    if (config && 'title' in config) return config.title;
    return key;
  };
  return (
    <article className='w-full bg-solid-gray-50 p-4 rounded-12 lg:p-6'>
      <h3 className='sr-only'>入力内容</h3>
      <div>
        <Ul>
          {Object.keys(inputs ?? {}).map((key) => {
            if (isFileInputItems(inputs[key])) {
              return (
                <li key={key} className='text-solid-gray-800'>
                  {getFilesInfo(inputs[key], uiJson)}
                </li>
              );
            } else if (
              key === 'conversation_histories' ||
              key === systemPromptKey ||
              uiJson?.[key]?.type === 'hidden'
            ) {
              return null;
            } else {
              return (
                <li key={key} className='text-solid-gray-800'>
                  {getLabel(key)}: {String(inputs[key])}
                </li>
              );
            }
          })}
        </Ul>
        {inputs?.[systemPromptKey] && (
          <Disclosure className='mt-4 ml-2.5 border-b border-b-solid-gray-536'>
            <DisclosureSummary className='w-full py-2'>システムプロンプト</DisclosureSummary>
            <pre className='my-2 pl-7 text-dns-16N-130 wrap-break-word whitespace-pre-wrap'>
              {String(inputs[systemPromptKey])}
            </pre>
          </Disclosure>
        )}
        {inputs?.['conversation_histories'] &&
          Array.isArray(inputs['conversation_histories']) &&
          inputs['conversation_histories'].length > 0 && (
            <Disclosure className='ml-2.5 border-b border-b-solid-gray-536'>
              <DisclosureSummary className='w-full py-2'>会話履歴</DisclosureSummary>
              <pre className='my-2 pl-7 text-dns-16N-130 wrap-break-word whitespace-pre-wrap'>
                {formatConversationHistory(
                  inputs['conversation_histories'] as ConversationHistory[],
                )}
              </pre>
            </Disclosure>
          )}
      </div>
    </article>
  );
};
