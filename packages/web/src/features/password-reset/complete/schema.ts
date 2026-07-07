import { createPasswordPolicyStringSchema } from '@genai-web/common';
import { z } from 'zod';
import { PASSWORD_POLICY, PASSWORD_POLICY_ERROR_MESSAGE } from '../constants';

const passwordPolicySchema = createPasswordPolicyStringSchema(PASSWORD_POLICY, {
  invalidMessage: PASSWORD_POLICY_ERROR_MESSAGE,
});

export const passwordResetCompleteSchema = z
  .object({
    email: z
      .string()
      .min(1, 'メールアドレスは必須です。')
      .email('有効なメールアドレスを入力してください。'),
    confirmationCode: z.string().regex(/^\d{6}$/, '6桁の認証コードを入力してください。'),
    newPassword: passwordPolicySchema,
    confirmPassword: z.string().min(1, '確認用パスワードは必須です。'),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: '確認用パスワードが一致しません。',
      });
    }
  });

export type PasswordResetCompleteSchema = z.infer<typeof passwordResetCompleteSchema>;
