import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('../../../lambda/utils/api', () => ({
  default: {
    bedrock: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('../../../lambda/utils/models', () => ({
  defaultModel: { type: 'bedrock', modelId: 'test-model' },
}));

import { predictExAppTitle } from '../../../lambda/utils/predictExAppTitle';

describe('predictExAppTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildInputSummary (via prompt)', () => {
    const extractInputFromPrompt = (prompt: string): string => {
      const match = prompt.match(/<input>([\s\S]*?)<\/input>/);
      return match ? match[1] : '';
    };

    it('Web形式のファイル入力からfilenameを抽出する', async () => {
      mockInvoke.mockResolvedValue('<output>テスト</output>');

      const inputs = {
        files: [
          { files: [{ filename: 'report.pdf' }, { filename: 'data.csv' }] },
        ],
      };
      await predictExAppTitle(inputs, 'output');

      const prompt = mockInvoke.mock.calls[0][1][0].content;
      const inputPart = extractInputFromPrompt(prompt);
      expect(inputPart).toBe('添付ファイル: report.pdf, data.csv');
    });

    it('ファイルとテキスト入力が混在する場合、両方を含める', async () => {
      mockInvoke.mockResolvedValue('<output>テスト</output>');

      const inputs = {
        prompt: 'これを要約して',
        files: [
          { files: [{ filename: 'doc.pdf' }] },
        ],
      };
      await predictExAppTitle(inputs, 'output');

      const prompt = mockInvoke.mock.calls[0][1][0].content;
      const inputPart = extractInputFromPrompt(prompt);
      expect(inputPart).toContain('これを要約して');
      expect(inputPart).toContain('添付ファイル: doc.pdf');
    });

    it('ファイル名がない場合はJSON文字列化にフォールバックする', async () => {
      mockInvoke.mockResolvedValue('<output>テスト</output>');

      const inputs = {
        files: [{ files: [] }],
      };
      await predictExAppTitle(inputs, 'output');

      const prompt = mockInvoke.mock.calls[0][1][0].content;
      const inputPart = extractInputFromPrompt(prompt);
      expect(inputPart).toBe(JSON.stringify(inputs));
    });

    it('テキストのみの入力はJSON文字列化される', async () => {
      mockInvoke.mockResolvedValue('<output>テスト</output>');

      const inputs = { prompt: 'テスト入力' };
      await predictExAppTitle(inputs, 'output');

      const prompt = mockInvoke.mock.calls[0][1][0].content;
      const inputPart = extractInputFromPrompt(prompt);
      expect(inputPart).toBe(JSON.stringify(inputs));
    });
  });
});
