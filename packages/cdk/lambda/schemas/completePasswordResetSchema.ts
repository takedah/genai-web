import {
  buildPasswordPolicyMessage,
  createPasswordPolicyStringSchema,
  parsePasswordPolicy,
} from '@genai-web/common';
import { z } from 'zod';

const passwordPolicy = parsePasswordPolicy(process.env.PASSWORD_POLICY);
export const PASSWORD_POLICY_ERROR_MESSAGE = buildPasswordPolicyMessage(passwordPolicy);

const INVALID_CODE_MESSAGE = '認証コードが正しくないか、有効期限が切れています。';

const passwordPolicySchema = createPasswordPolicyStringSchema(passwordPolicy, {
  invalidMessage: PASSWORD_POLICY_ERROR_MESSAGE,
});

export const completePasswordResetSchema = z
  .object({
    email: z
      .string({ error: 'メールアドレスの形式が不正です。' })
      .min(1, 'メールアドレスは必須です。')
      .email('有効なメールアドレスを入力してください。'),
    confirmationCode: z
      .string({ error: INVALID_CODE_MESSAGE })
      .regex(/^\d{6}$/, '6桁の認証コードを入力してください。'),
    newPassword: passwordPolicySchema,
    confirmPassword: z
      .string({ error: '確認用パスワードは必須です。' })
      .min(1, '確認用パスワードは必須です。'),
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

export type CompleteResetSubmission = z.infer<typeof completePasswordResetSchema>;
