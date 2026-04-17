import { FallbackProps } from 'react-error-boundary';
import { PageTitle } from '../PageTitle';
import { Button } from './dads/Button';

export const GlobalErrorFallback = ({ resetErrorBoundary }: FallbackProps) => {
  return (
    <>
      <PageTitle title='予期しないエラーが発生しました' />
      <div className='m-8'>
        <main id='mainContents' className='flex flex-col gap-4'>
          <h1
            tabIndex={-1}
            id='offline-title'
            className='mb-8 text-std-28B-150 focus-visible:rounded-4 focus-visible:bg-yellow-300 focus-visible:ring-[calc(2/16*1rem)] focus-visible:ring-yellow-300 focus-visible:outline-4 focus-visible:outline-offset-[calc(2/16*1rem)] focus-visible:outline-black focus-visible:outline-solid lg:mt-12 lg:text-std-45B-140'
          >
            予期しないエラーが発生しました
          </h1>

          <p className='text-std-18N-160'>しばらく時間をおいてから再度お試しください。</p>

          <Button
            className='w-full max-w-3xs'
            variant='solid-fill'
            size='md'
            onClick={resetErrorBoundary}
          >
            ページを再読み込み
          </Button>
        </main>
      </div>
    </>
  );
};
