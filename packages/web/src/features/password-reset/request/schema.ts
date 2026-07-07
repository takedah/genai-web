import { z } from 'zod';

export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスは必須です。')
    .email('有効なメールアドレスを入力してください。'),
});

export type PasswordResetRequestSchema = z.infer<typeof passwordResetRequestSchema>;
