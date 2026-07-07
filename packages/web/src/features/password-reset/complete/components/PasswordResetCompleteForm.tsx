import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router';
import { ErrorText } from '@/components/ui/dads/ErrorText';
import { Input } from '@/components/ui/dads/Input';
import { Label } from '@/components/ui/dads/Label';
import { Link } from '@/components/ui/dads/Link';
import { RequirementBadge } from '@/components/ui/dads/RequirementBadge';
import { StatusBadge } from '@/components/ui/dads/StatusBadge';
import { SupportText } from '@/components/ui/dads/SupportText';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { isApiError } from '@/lib/fetcher';
import { focus } from '@/utils/focus';
import { PASSWORD_POLICY_SUPPORT_TEXT, PASSWORD_RESET_REQUEST_PATH } from '../../constants';
import { useCompletePasswordReset } from '../hooks/useCompletePasswordReset';
import { PasswordResetCompleteSchema, passwordResetCompleteSchema } from '../schema';

type Props = {
  email: string;
};

const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    const data = error.data as { error?: string } | undefined;
    return data?.error ?? '';
  }
  return 'システムエラーが発生しました。ページをリロードして再度お試しください。';
};

export const PasswordResetCompleteForm = (props: Props) => {
  const navigate = useNavigate();
  const { email } = props;
  const { completePasswordReset } = useCompletePasswordReset();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordResetCompleteSchema>({
    mode: 'onSubmit',
    resolver: zodResolver(passwordResetCompleteSchema),
    defaultValues: {
      email,
      confirmationCode: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      setError('');
      setIsLoading(true);
      await completePasswordReset({
        email: data.email,
        confirmationCode: data.confirmationCode,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      reset();
      navigate('/');
    } catch (e) {
      setError(getErrorMessage(e));
      focus('server-error');
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className='flex flex-col gap-3 my-6'>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='password-reset-email-input' size='lg'>
          メールアドレス
          <StatusBadge>編集不可</StatusBadge>
        </Label>
        <SupportText id='password-reset-email-input-support'>
          パスワード再設定メールの送信先です。
        </SupportText>
        <Input
          id='password-reset-email-input'
          type='email'
          required
          className='w-full'
          aria-describedby='password-reset-email-input-support'
          readOnly
          {...register('email')}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='password-reset-confirmation-code-input' size='lg'>
          認証コード<RequirementBadge>※必須</RequirementBadge>
        </Label>
        <SupportText id='password-reset-confirmation-code-input-support'>
          メールに記載された6桁の認証コードを入力してください。
        </SupportText>
        <Input
          id='password-reset-confirmation-code-input'
          type='text'
          inputMode='numeric'
          autoComplete='one-time-code'
          required
          className='w-full'
          aria-describedby={
            errors.confirmationCode
              ? 'password-reset-confirmation-code-input-support password-reset-confirmation-code-input-error'
              : 'password-reset-confirmation-code-input-support'
          }
          {...register('confirmationCode')}
        />
        {errors.confirmationCode && (
          <ErrorText id='password-reset-confirmation-code-input-error'>
            ＊{errors.confirmationCode.message}
          </ErrorText>
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='password-reset-new-password-input' size='lg'>
          新しいパスワード<RequirementBadge>※必須</RequirementBadge>
        </Label>
        <SupportText id='password-reset-new-password-input-support'>
          {PASSWORD_POLICY_SUPPORT_TEXT}
        </SupportText>
        <Input
          id='password-reset-new-password-input'
          type='password'
          autoComplete='new-password'
          required
          className='w-full'
          aria-describedby={
            errors.newPassword
              ? 'password-reset-new-password-input-support password-reset-new-password-input-error'
              : 'password-reset-new-password-input-support'
          }
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <ErrorText id='password-reset-new-password-input-error'>
            ＊{errors.newPassword.message}
          </ErrorText>
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='password-reset-confirm-password-input' size='lg'>
          新しいパスワード（確認）<RequirementBadge>※必須</RequirementBadge>
        </Label>
        <SupportText id='password-reset-confirm-password-input-support'>
          確認のため、同じパスワードをもう一度入力してください。
        </SupportText>
        <Input
          id='password-reset-confirm-password-input'
          type='password'
          autoComplete='new-password'
          required
          className='w-full'
          aria-describedby={
            errors.confirmPassword
              ? 'password-reset-confirm-password-input-support password-reset-confirm-password-input-error'
              : 'password-reset-confirm-password-input-support'
          }
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <ErrorText id='password-reset-confirm-password-input-error'>
            ＊{errors.confirmPassword.message}
          </ErrorText>
        )}
      </div>

      {error && (
        <section className='my-4'>
          <h3 id='server-error' className='sr-only' tabIndex={-1}>
            システムエラー
          </h3>
          <div className='mx-auto flex w-full flex-col gap-2 rounded-6 bg-red-50 p-4 text-center text-error-1'>
            <p>{error}</p>
          </div>
          <p className='mt-4 text-center'>
            <Link asChild>
              <RouterLink to={PASSWORD_RESET_REQUEST_PATH}>再設定メールを再送信する</RouterLink>
            </Link>
          </p>
        </section>
      )}

      <div className='mt-4 flex justify-center gap-2'>
        <LoadingButton
          type='submit'
          variant='solid-fill'
          size='lg'
          className='w-full'
          loading={isLoading}
        >
          {isLoading ? '更新中' : '更新'}
        </LoadingButton>
      </div>
    </form>
  );
};
