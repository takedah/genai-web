import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ErrorText } from '@/components/ui/dads/ErrorText';
import { Input } from '@/components/ui/dads/Input';
import { Label } from '@/components/ui/dads/Label';
import { RequirementBadge } from '@/components/ui/dads/RequirementBadge';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { isApiError } from '@/lib/fetcher';
import { focus } from '@/utils/focus';
import { PASSWORD_RESET_COMPLETE_PATH } from '../../constants';
import { useRequestPasswordReset } from '../hooks/useRequestPasswordReset';
import { PasswordResetRequestSchema, passwordResetRequestSchema } from '../schema';

const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    const data = error.data as { error?: string } | undefined;
    return data?.error ?? '';
  }
  return 'システムエラーが発生しました。ページをリロードして再度お試しください。';
};

export const PasswordResetRequestForm = () => {
  const navigate = useNavigate();
  const { requestPasswordReset } = useRequestPasswordReset();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestSchema>({
    mode: 'onSubmit',
    resolver: zodResolver(passwordResetRequestSchema),
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      setError('');
      setIsLoading(true);
      await requestPasswordReset(data.email);
      navigate(PASSWORD_RESET_COMPLETE_PATH, {
        state: {
          email: data.email,
        },
      });
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
          メールアドレス<RequirementBadge>※必須</RequirementBadge>
        </Label>
        <Input
          id='password-reset-email-input'
          type='email'
          autoComplete='email'
          required
          className='w-full'
          aria-describedby={errors.email ? 'password-reset-email-input-error' : ''}
          {...register('email')}
        />
        {errors.email && (
          <ErrorText id='password-reset-email-input-error'>＊{errors.email.message}</ErrorText>
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
        </section>
      )}

      <div className='mt-4 flex justify-center'>
        <LoadingButton
          type='submit'
          variant='solid-fill'
          size='lg'
          className='w-full'
          loading={isLoading}
        >
          {isLoading ? '送信中' : '送信'}
        </LoadingButton>
      </div>
    </form>
  );
};
