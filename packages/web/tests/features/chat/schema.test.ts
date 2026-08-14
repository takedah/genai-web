import { describe, expect, it } from 'vitest';
import { chatFormSchema } from '@/features/chat/schema';

const MAX_BYTES = 400 * 1024;

describe('chatFormSchema', () => {
  describe('content バリデーション', () => {
    it('通常のテキストは通過する', () => {
      expect(chatFormSchema.safeParse({ content: 'こんにちは' }).success).toBe(true);
    });

    it('空文字はエラー', () => {
      const result = chatFormSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('空白のみはエラー', () => {
      const result = chatFormSchema.safeParse({ content: '   ' });
      expect(result.success).toBe(false);
    });

    it('400KB ちょうどは通過する', () => {
      const content = 'a'.repeat(MAX_BYTES);
      expect(chatFormSchema.safeParse({ content }).success).toBe(true);
    });

    it('400KB - 1 バイトは通過する', () => {
      const content = 'a'.repeat(MAX_BYTES - 1);
      expect(chatFormSchema.safeParse({ content }).success).toBe(true);
    });

    it('400KB + 1 バイトはエラー', () => {
      const content = 'a'.repeat(MAX_BYTES + 1);
      const result = chatFormSchema.safeParse({ content });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'メッセージの内容が大きすぎます。内容を短くしてから送信してください。',
        );
      }
    });

    it('マルチバイト文字 (UTF-8 3 バイト/文字) で 400KB 超はエラー', () => {
      // 「あ」は UTF-8 で 3 バイト。400KB / 3 + 1 文字で超過
      const content = 'あ'.repeat(Math.floor(MAX_BYTES / 3) + 1);
      const result = chatFormSchema.safeParse({ content });
      expect(result.success).toBe(false);
    });
  });
});
