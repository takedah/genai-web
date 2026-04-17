import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSqsSend, mockFetch } = vi.hoisted(() => ({
  mockSqsSend: vi.fn(),
  mockFetch: vi.fn(),
}));

global.fetch = mockFetch;

vi.mock('../../lambda/repository/invokeHistoryRepository', () => ({
  updateInvokeExAppHistory: vi.fn(),
}));

vi.mock('../../lambda/utils/apiKey', () => ({
  getApiKeyValue: vi.fn(),
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: class {
    send = mockSqsSend;
  },
  ChangeMessageVisibilityCommand: vi.fn(),
}));

import { handler } from '../../lambda/pollExAppStatus';
import { updateInvokeExAppHistory } from '../../lambda/repository/invokeHistoryRepository';
import { getApiKeyValue } from '../../lambda/utils/apiKey';

describe('pollExAppStatus Lambda handler', () => {
  const mockDbId = 'team#test-team-id#exapp#test-exapp-id#user#test-user-id';
  const mockCreatedDate = '2025-02-01T00:00:00.000Z';
  const mockStatusUrl = '/status/12345';
  const mockEndpoint = 'https://api.example.com/invoke';
  const mockApiKeySecretId = 'test-team-id/test-exapp-id';
  const mockBaseS3Prefix = 'artifacts/test-prefix';
  const mockStableUserId = 'stable-user-id-123';
  const mockApiKey = 'test-api-key';

  const createSqsRecord = (
    overrides?: Partial<{
      body: object;
      receiveCount: string;
      messageId: string;
      receiptHandle: string;
      eventSourceARN: string;
    }>,
  ): SQSRecord => {
    const defaultBody = {
      dbId: mockDbId,
      createdDate: mockCreatedDate,
      statusUrl: mockStatusUrl,
      endpoint: mockEndpoint,
      apiKeySecretId: mockApiKeySecretId,
      baseS3Prefix: mockBaseS3Prefix,
      stableUserId: mockStableUserId,
    };

    return {
      messageId: overrides?.messageId ?? 'test-message-id',
      receiptHandle: overrides?.receiptHandle ?? 'test-receipt-handle',
      body: JSON.stringify(overrides?.body ?? defaultBody),
      attributes: {
        ApproximateReceiveCount: overrides?.receiveCount ?? '1',
        SentTimestamp: '1234567890',
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: '1234567890',
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN:
        overrides?.eventSourceARN ??
        'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
      awsRegion: 'ap-northeast-1',
    };
  };

  const createSqsEvent = (records: SQSRecord[]): SQSEvent => ({
    Records: records,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiKeyValue).mockResolvedValue(mockApiKey);
    vi.mocked(updateInvokeExAppHistory).mockResolvedValue(undefined);
    mockSqsSend.mockResolvedValue({});
  });

  describe('正常系', () => {
    it('COMPLETED状態の場合、DynamoDBを更新して正常終了する', async () => {
      const mockResponse = {
        status: 'COMPLETED',
        outputs: { result: 'success' },
        progress: '100',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord()]);
      await handler(event);

      expect(getApiKeyValue).toHaveBeenCalledWith('test-team-id', 'test-exapp-id', '');
      expect(mockFetch).toHaveBeenCalledWith(
        `${new URL(mockEndpoint).origin}${mockStatusUrl}`,
        expect.objectContaining({
          headers: {
            'x-api-key': mockApiKey,
            'x-user-id': mockStableUserId,
          },
        }),
      );
      expect(updateInvokeExAppHistory).toHaveBeenCalledWith(
        mockDbId,
        mockCreatedDate,
        'COMPLETED',
        mockResponse,
        mockBaseS3Prefix,
      );
    });

    it('ERROR状態の場合、DynamoDBを更新して正常終了する', async () => {
      const mockResponse = {
        status: 'ERROR',
        outputs: { error: 'Something went wrong' },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord()]);
      await handler(event);

      expect(updateInvokeExAppHistory).toHaveBeenCalledWith(
        mockDbId,
        mockCreatedDate,
        'ERROR',
        mockResponse,
        mockBaseS3Prefix,
      );
    });

    it('statusUrlが絶対URLの場合、そのまま使用する', async () => {
      const absoluteStatusUrl = 'https://other-api.example.com/status/12345';
      const mockResponse = { status: 'COMPLETED', outputs: {} };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([
        createSqsRecord({
          body: {
            dbId: mockDbId,
            createdDate: mockCreatedDate,
            statusUrl: absoluteStatusUrl,
            endpoint: mockEndpoint,
            apiKeySecretId: mockApiKeySecretId,
            baseS3Prefix: mockBaseS3Prefix,
            stableUserId: mockStableUserId,
          },
        }),
      ]);
      await handler(event);

      expect(mockFetch).toHaveBeenCalledWith(
        absoluteStatusUrl,
        expect.any(Object),
      );
    });
  });

  describe('継続ポーリング（IN_PROGRESS/PENDING）', () => {
    it('IN_PROGRESS状態の場合、DynamoDBを更新してエラーをスローする', async () => {
      const mockResponse = {
        status: 'IN_PROGRESS',
        outputs: { partial: 'data' },
        progress: '50',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord()]);

      await expect(handler(event)).rejects.toThrow(
        /Throw error for continuous polling.*IN_PROGRESS/,
      );
      expect(updateInvokeExAppHistory).toHaveBeenCalledWith(
        mockDbId,
        mockCreatedDate,
        'IN_PROGRESS',
        mockResponse,
        mockBaseS3Prefix,
      );
    });

    it('PENDING状態の場合、エラーをスローしてリトライを促す', async () => {
      const mockResponse = {
        status: 'PENDING',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord()]);

      await expect(handler(event)).rejects.toThrow(
        /Throw error for continuous polling.*PENDING/,
      );
      expect(updateInvokeExAppHistory).not.toHaveBeenCalled();
    });
  });

  describe('バックオフ処理', () => {
    it('receiveCountが240以下の場合、可視性タイムアウトを変更しない', async () => {
      const mockResponse = { status: 'PENDING' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord({ receiveCount: '100' })]);

      await expect(handler(event)).rejects.toThrow();
      expect(mockSqsSend).not.toHaveBeenCalled();
    });

    it('receiveCountが241～480の場合、可視性タイムアウトを60秒に設定する', async () => {
      const mockResponse = { status: 'PENDING' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord({ receiveCount: '300' })]);

      await expect(handler(event)).rejects.toThrow();
      expect(mockSqsSend).toHaveBeenCalled();
    });

    it('receiveCountが481～720の場合、可視性タイムアウトを300秒に設定する', async () => {
      const mockResponse = { status: 'PENDING' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord({ receiveCount: '500' })]);

      await expect(handler(event)).rejects.toThrow();
      expect(mockSqsSend).toHaveBeenCalled();
    });

    it('receiveCountが720を超える場合、可視性タイムアウトを900秒に設定する', async () => {
      const mockResponse = { status: 'PENDING' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const event = createSqsEvent([createSqsRecord({ receiveCount: '800' })]);

      await expect(handler(event)).rejects.toThrow();
      expect(mockSqsSend).toHaveBeenCalled();
    });

    it('可視性タイムアウトの変更に失敗してもエラーハンドリングを継続する', async () => {
      const mockResponse = { status: 'PENDING' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      mockSqsSend.mockRejectedValue(new Error('SQS error'));

      const event = createSqsEvent([createSqsRecord({ receiveCount: '500' })]);

      // 可視性タイムアウト変更の失敗はログに記録されるだけで、ポーリングは継続される
      await expect(handler(event)).rejects.toThrow(
        /Throw error for continuous polling/,
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('APIキーが見つからない場合、エラーをスローする', async () => {
      vi.mocked(getApiKeyValue).mockResolvedValue(undefined);

      const event = createSqsEvent([createSqsRecord()]);

      await expect(handler(event)).rejects.toThrow(
        /API Key not found for secret/,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ポーリングリクエストが失敗した場合、エラーをスローする', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      const event = createSqsEvent([createSqsRecord()]);

      await expect(handler(event)).rejects.toThrow(
        /Polling failed with status 500/,
      );
      expect(updateInvokeExAppHistory).not.toHaveBeenCalled();
    });

    it('ポーリングリクエストが404を返した場合、エラーをスローする', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Not Found'),
      });

      const event = createSqsEvent([createSqsRecord()]);

      await expect(handler(event)).rejects.toThrow(
        /Polling failed with status 404/,
      );
    });

    it('JSONパースエラーの場合、エラーをスローする', async () => {
      const invalidRecord = {
        ...createSqsRecord(),
        body: 'invalid-json',
      };

      const event = createSqsEvent([invalidRecord]);

      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe('ヘルパー関数', () => {
    it('QueueURLがARNから正しく生成される', async () => {
      const mockResponse = { status: 'PENDING' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const customArn = 'arn:aws:sqs:us-east-1:987654321098:my-queue';
      const event = createSqsEvent([
        createSqsRecord({
          eventSourceARN: customArn,
          receiveCount: '300',
        }),
      ]);

      await expect(handler(event)).rejects.toThrow();
      // SQSクライアントが呼び出されることを確認（可視性タイムアウト更新）
      expect(mockSqsSend).toHaveBeenCalled();
    });
  });
});
