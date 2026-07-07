import { PageTitle } from '@/components/PageTitle';
import { Button } from '@/components/ui/dads/Button';
import { APP_TITLE } from '@/constants';
import { Layout } from '../layout/Layout';
import { PasswordResetRequestForm } from './components/PasswordResetRequestForm';

export const PasswordResetRequestPage = () => {
  const title = 'パスワード再設定（メール送信）';

  return (
    <Layout>
      <PageTitle title={`${title} | ${APP_TITLE}`} />
      <h1 className='mt-8 mb-6 flex justify-center text-std-32B-150 text-solid-gray-900'>
        {APP_TITLE}
      </h1>
      <section className='w-full max-w-[calc(480/16*1rem)] border border-solid-gray-420 bg-white'>
        <h2
          id='password-reset-header'
          tabIndex={-1}
          className='mx-8 mt-8 text-std-24B-150 text-solid-gray-800 focus-visible:rounded-4 focus-visible:bg-yellow-300 focus-visible:ring-[calc(2/16*1rem)] focus-visible:ring-yellow-300 focus-visible:outline-4 focus-visible:outline-offset-[calc(2/16*1rem)] focus-visible:outline-black focus-visible:outline-solid'
        >
          {title}
        </h2>
        <div className='mx-8 mt-4 mb-8'>
          <p className='mb-6 text-std-16N-170'>パスワード再設定用のメールを送信します。</p>
          <PasswordResetRequestForm />
          <p className='mt-6 text-center'>
            <Button variant='text' size='lg' asChild>
              <a href='/'>サインインに戻る</a>
            </Button>
          </p>
        </div>
      </section>
    </Layout>
  );
};
