import { ExApp } from 'genai-web';
import { ExAppUsageMarkdownRenderer } from './ExAppUsageMarkdownRenderer';

type Props = {
  exApp: ExApp;
};

export const ExAppHeader = (props: Props) => {
  const { exApp } = props;

  return (
    <div className='mb-6 flex flex-col gap-4'>
      <div className='flex items-baseline gap-1'>
        <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>
          {exApp?.exAppName}
        </h1>
      </div>
      {exApp?.howToUse && <ExAppUsageMarkdownRenderer content={exApp.howToUse} size='sm' />}
    </div>
  );
};
