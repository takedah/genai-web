import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { Link } from '@/components/ui/dads/Link';
import { APP_TITLE } from '@/constants';
import { PASSWORD_RESET_REQUEST_PATH } from '../constants';
import { Layout } from '../layout/Layout';
import { PasswordResetCompleteForm } from './components/PasswordResetCompleteForm';

export const PasswordResetCompletePage = () => {
  const location = useLocation();
  const [email] = useState(() => {
    const state = location.state as { email?: unknown } | null;
    return typeof state?.email === 'string' ? state.email : '';
  });
  const title = 'パスワード再設定（新しいパスワードを設定）';

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
          <p className='mb-6 text-std-16N-170'>
            登録しているメールアドレスに送信された6桁の認証コードを入力し、新しいパスワードを設定してください。
          </p>
          {email ? (
            <PasswordResetCompleteForm email={email} />
          ) : (
            <section className='my-4'>
              <h3 id='server-error' className='sr-only' tabIndex={-1}>
                システムエラー
              </h3>
              <div className='mx-auto flex w-full flex-col gap-2 rounded-6 bg-red-50 p-4 text-center text-error-1'>
                <p>メールアドレス入力からやり直してください。</p>
              </div>
              <p className='mt-4 text-center'>
                <Link asChild>
                  <RouterLink to={PASSWORD_RESET_REQUEST_PATH}>再設定メールを再送信する</RouterLink>
                </Link>
              </p>
            </section>
          )}
          <p className='mt-6 text-center'>
            <Link href='/' className='text-std-16N-170'>
              サインインに戻る
            </Link>
          </p>
        </div>
      </section>
    </Layout>
  );
};
