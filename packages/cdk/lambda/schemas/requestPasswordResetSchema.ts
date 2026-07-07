import { z } from 'zod';

export const requestPasswordResetSchema = z.object({
  email: z
    .string({ error: 'メールアドレスの形式が不正です。' })
    .min(1, 'メールアドレスは必須です。')
    .email('有効なメールアドレスを入力してください。'),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
