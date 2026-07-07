import type { ShownMessage, UploadedFileType } from 'genai-web';
import { describe, expect, it, vi } from 'vitest';

// useChat が @/models のロード時に JSON.parse する env を import 前に埋める
vi.stubEnv('VITE_APP_MODEL_IDS', '[]');
vi.stubEnv('VITE_APP_ENDPOINT_NAMES', '[]');
vi.stubEnv('VITE_APP_IMAGE_MODEL_IDS', '[]');

const { formatMessageProperties } = await import('@/hooks/useChat');

// s3Url は https 形式（署名付き URL のベース）で保持され、getS3Uri で s3:// に変換される
const HTTPS_URL = 'https://my-bucket.s3.ap-northeast-1.amazonaws.com/id/uuid/report.pdf';
const S3_URI = 's3://my-bucket/id/uuid/report.pdf';

const userMessage = (extraData: ShownMessage['extraData']): ShownMessage =>
  ({
    role: 'user',
    content: 'hello',
    extraData,
  }) as ShownMessage;

describe('formatMessageProperties', () => {
  describe('sendFilesAsS3 = true（chat 経路）', () => {
    it('file/image を s3 ソース（s3:// URI）に変換して送る', () => {
      const messages = [
        userMessage([
          {
            type: 'file',
            name: 'report.pdf',
            source: { type: 's3', mediaType: 'application/pdf', data: HTTPS_URL },
          },
          {
            type: 'image',
            name: 'pic.png',
            source: { type: 's3', mediaType: 'image/png', data: HTTPS_URL },
          },
        ]),
      ];

      const result = formatMessageProperties(messages, undefined, undefined, undefined, true);

      expect(result[0].extraData).toEqual([
        {
          type: 'file',
          name: 'report.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: S3_URI },
        },
        {
          type: 'image',
          name: 'pic.png',
          source: { type: 's3', mediaType: 'image/png', data: S3_URI },
        },
      ]);
    });

    it('s3Url が空のとき例外を投げず、当該 extra を除外する', () => {
      const messages = [
        userMessage([
          {
            type: 'file',
            name: 'pending.pdf',
            source: { type: 's3', mediaType: 'application/pdf', data: '' },
          },
          {
            type: 'file',
            name: 'ok.pdf',
            source: { type: 's3', mediaType: 'application/pdf', data: HTTPS_URL },
          },
        ]),
      ];

      // 空 s3Url で getS3Uri を呼ばずクラッシュしないこと
      const result = formatMessageProperties(messages, undefined, undefined, undefined, true);

      // 空のものは落ち、正規のものだけ残る
      expect(result[0].extraData).toEqual([
        {
          type: 'file',
          name: 'ok.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: S3_URI },
        },
      ]);
    });
  });

  describe('sendFilesAsS3 = false（base64 維持）', () => {
    it('image/file は base64 ソースに変換し、data: プレフィックスを除去する', () => {
      const uploadedFiles: UploadedFileType[] = [
        {
          file: new File(['x'], 'pic.png', { type: 'image/png' }),
          name: 'pic.png',
          type: 'image',
          uploading: false,
          s3Url: HTTPS_URL,
          base64EncodedData: 'data:image/png;base64,QUJD',
          errorMessages: [],
        } as UploadedFileType,
      ];
      const messages = [
        userMessage([
          {
            type: 'image',
            name: 'pic.png',
            source: { type: 's3', mediaType: 'image/png', data: HTTPS_URL },
          },
        ]),
      ];

      const result = formatMessageProperties(messages, uploadedFiles, undefined, undefined, false);

      expect(result[0].extraData).toEqual([
        {
          type: 'image',
          name: 'pic.png',
          source: { type: 'base64', mediaType: 'image/png', data: 'QUJD' },
        },
      ]);
    });

    it('base64Cache からも base64 を解決でき、プレフィックスを除去する', () => {
      const base64Cache = { [HTTPS_URL]: 'data:image/png;base64,WFla' };
      const messages = [
        userMessage([
          {
            type: 'image',
            name: 'pic.png',
            source: { type: 's3', mediaType: 'image/png', data: HTTPS_URL },
          },
        ]),
      ];

      const result = formatMessageProperties(messages, undefined, undefined, base64Cache, false);

      expect(result[0].extraData).toEqual([
        {
          type: 'image',
          name: 'pic.png',
          source: { type: 'base64', mediaType: 'image/png', data: 'WFla' },
        },
      ]);
    });

    it('base64 が見つからない（uploadedFiles/cache 双方なし）と除外する', () => {
      const messages = [
        userMessage([
          {
            type: 'image',
            name: 'pic.png',
            source: { type: 's3', mediaType: 'image/png', data: HTTPS_URL },
          },
        ]),
      ];

      const result = formatMessageProperties(messages, undefined, undefined, undefined, false);

      expect(result[0].extraData).toEqual([]);
    });
  });

  describe('video', () => {
    it('sendFilesAsS3 = false でも video は常に s3 ソース（s3:// URI）で送る', () => {
      const messages = [
        userMessage([
          {
            type: 'video',
            name: 'movie.mp4',
            source: { type: 's3', mediaType: 'video/mp4', data: HTTPS_URL },
          },
        ]),
      ];

      const result = formatMessageProperties(messages, undefined, undefined, undefined, false);

      expect(result[0].extraData).toEqual([
        {
          type: 'video',
          name: 'movie.mp4',
          source: { type: 's3', mediaType: 'video/mp4', data: S3_URI },
        },
      ]);
    });
  });

  describe('混在・結合', () => {
    it('追加の extraData が変換後 extraData の後ろに結合される', () => {
      const extraData = [
        {
          type: 'file',
          name: 'extra.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: S3_URI },
        },
      ] as ShownMessage['extraData'];
      const messages = [
        userMessage([
          {
            type: 'file',
            name: 'report.pdf',
            source: { type: 's3', mediaType: 'application/pdf', data: HTTPS_URL },
          },
        ]),
      ];

      const result = formatMessageProperties(messages, undefined, extraData, undefined, true);

      expect(result[0].extraData).toEqual([
        {
          type: 'file',
          name: 'report.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: S3_URI },
        },
        {
          type: 'file',
          name: 'extra.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: S3_URI },
        },
      ]);
    });

    it('extraData を持たないメッセージはそのまま（content/role 維持）', () => {
      const messages = [userMessage(undefined)];

      const result = formatMessageProperties(messages, undefined, undefined, undefined, true);

      expect(result[0]).toMatchObject({ role: 'user', content: 'hello' });
      expect(result[0].extraData).toEqual([]);
    });
  });
});
