import { z } from 'zod';

export const chatFormSchema = z.object({
  content: z
    .string()
    .min(1, { message: 'メッセージを入力してください' })
    .refine(
      (value) => {
        return value.trim().length > 0;
      },
      {
        message: 'メッセージは空白のみでは送信できません。',
      },
    ),
});

export type ChatFormSchema = z.infer<typeof chatFormSchema>;

export const systemContextSaveSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください'),
  systemContext: z.string().min(1, 'システムプロンプトを入力してください'),
});

export type SystemContextSaveSchema = z.infer<typeof systemContextSaveSchema>;
