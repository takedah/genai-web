import { vi } from 'vitest';
// client.ts は import 時に process.env.INVOKE_HISTORY_TABLE_NAME を解決するため、
// vi.hoisted で import 前に env を設定する。
vi.hoisted(() => {
  process.env.INVOKE_HISTORY_TABLE_NAME = 'test-history-table';
  process.env.TABLE_NAME = 'test-table';
  process.env.EXAPP_TABLE_NAME = 'test-exapp-table';
  process.env.TTL_DAYS = '30';
  process.env.ARTIFACTS_BUCKET_NAME = 'test-artifacts';
});

import { S3Client } from '@aws-sdk/client-s3';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import type { UsageMetadata } from 'genai-web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createInvokeExAppHistory,
  findInvokeExAppHistory,
  listInvokeExAppHistories,
} from '../../../lambda/repository/invokeHistoryRepository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

const sampleUsageMetadata: UsageMetadata[] = [
  {
    estimatedCostInfo: { estimatedCost: 0.123, currency: 'USD' },
    modelVersion: 'gemini-2',
    requestCount: 1,
    tokens: { candidatesTokenCount: 50, promptTokenCount: 100, totalTokenCount: 150 },
  },
  {
    estimatedCostInfo: { estimatedCost: 0.077, currency: 'USD' },
    modelVersion: 'gemini-2',
    requestCount: 1,
    tokens: { candidatesTokenCount: 30, promptTokenCount: 70, totalTokenCount: 100 },
  },
];

describe('invokeHistoryRepository', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
  });
  afterEach(() => {
    ddbMock.reset();
    s3Mock.reset();
  });

  describe('itemToInvokeExAppHistory（findInvokeExAppHistory 経由）', () => {
    it('保存値が JSON 文字列の usageMetadata を UsageMetadata[] に復元し、totalEstimatedCost を構築する', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
            inputs: { prompt: 'test' },
            outputs: 'response',
            status: 'COMPLETED',
            teamName: 'Team',
            exAppName: 'App',
            usageMetadata: JSON.stringify(sampleUsageMetadata),
          },
        ],
      });

      const result = await findInvokeExAppHistory('team-1', 'exapp-1', 'user-1', '2026-01-01T00:00:00Z');

      expect(result.history?.usageMetadata).toEqual(sampleUsageMetadata);
      expect(result.history?.totalEstimatedCost).toBeDefined();
      expect(result.history?.totalEstimatedCost?.currency).toBe('USD');
      expect(result.history?.totalEstimatedCost?.totalCost).toBeCloseTo(0.2);
    });

    it('保存値が空オブジェクト "{}" の usageMetadata では undefined になる（後方互換）', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
            usageMetadata: JSON.stringify({}),
          },
        ],
      });

      const result = await findInvokeExAppHistory('team-1', 'exapp-1', 'user-1', '2026-01-01T00:00:00Z');

      expect(result.history?.usageMetadata).toBeUndefined();
      expect(result.history?.totalEstimatedCost).toBeUndefined();
    });

    it('不正 JSON では undefined に正規化される（壊れない）', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
            usageMetadata: 'not-json{',
          },
        ],
      });

      const result = await findInvokeExAppHistory('team-1', 'exapp-1', 'user-1', '2026-01-01T00:00:00Z');

      expect(result.history?.usageMetadata).toBeUndefined();
      expect(result.history?.totalEstimatedCost).toBeUndefined();
    });

    it('属性なし（旧履歴）でも壊れずに返る', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const result = await findInvokeExAppHistory('team-1', 'exapp-1', 'user-1', '2026-01-01T00:00:00Z');

      expect(result.history).toBeDefined();
      expect(result.history?.usageMetadata).toBeUndefined();
      expect(result.history?.totalEstimatedCost).toBeUndefined();
    });

    it('currency 混在保存値では totalEstimatedCost のみ undefined', async () => {
      const mixed: UsageMetadata[] = [
        { ...sampleUsageMetadata[0] },
        {
          ...sampleUsageMetadata[1],
          estimatedCostInfo: { estimatedCost: 100, currency: 'JPY' },
        },
      ];
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
            usageMetadata: JSON.stringify(mixed),
          },
        ],
      });

      const result = await findInvokeExAppHistory('team-1', 'exapp-1', 'user-1', '2026-01-01T00:00:00Z');

      // usageMetadata は壊さず復元する
      expect(result.history?.usageMetadata).toEqual(mixed);
      // totalEstimatedCost は通貨混在で undefined
      expect(result.history?.totalEstimatedCost).toBeUndefined();
    });
  });

  describe('listInvokeExAppHistories で複数アイテムを復元', () => {
    it('混在（usageMetadata あり / なし）でもアイテムごとに正しく処理される', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-02T00:00:00Z',
            usageMetadata: JSON.stringify(sampleUsageMetadata),
          },
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
          },
        ],
        LastEvaluatedKey: undefined,
      });

      const result = await listInvokeExAppHistories('team-1', 'exapp-1', 'user-1', null);

      expect(result.history.length).toBe(2);
      expect(result.history[0].usageMetadata).toEqual(sampleUsageMetadata);
      expect(result.history[0].totalEstimatedCost?.totalCost).toBeCloseTo(0.2);
      expect(result.history[1].usageMetadata).toBeUndefined();
      expect(result.history[1].totalEstimatedCost).toBeUndefined();
    });
  });

  describe('ラウンドトリップ', () => {
    it('createInvokeExAppHistory で usageMetadata（オブジェクト配列）を保存→取得で復元できる', async () => {
      // S3 保存（saveFilesToS3）は actual には呼ばれるが本テストでは file を含めないので
      // mock がなくても通る（artifact / files プロパティ無し）。
      ddbMock.on(PutCommand).resolves({});

      const result: { usageMetadata: UsageMetadata[]; outputs: string; timestamps: object } = {
        outputs: 'response text',
        timestamps: { processingStartedAt: '2026', processingEndedAt: '2026' },
        usageMetadata: sampleUsageMetadata,
      };

      await createInvokeExAppHistory(
        'team-1#exapp-1#user-1',
        '2026-01-01T00:00:00Z',
        'team-1',
        'exapp-1',
        'user-1',
        'team-1/exapp-1/user-1/2026-01-01',
        { prompt: 'test' },
        result,
        'Team Name',
        'App Name',
        'COMPLETED',
      );

      // PutCommand の引数を検証: usageMetadata が JSON 文字列として保存される
      const putCalls = ddbMock.commandCalls(PutCommand);
      expect(putCalls.length).toBe(1);
      const item = putCalls[0].args[0].input.Item as Record<string, unknown>;
      expect(typeof item.usageMetadata).toBe('string');
      const parsed = JSON.parse(item.usageMetadata as string);
      expect(parsed).toEqual(sampleUsageMetadata);

      // 復元: その保存値（JSON 文字列）を DDB から取得した想定で findInvokeExAppHistory を呼ぶ
      ddbMock.reset();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            pk: 'team-1#exapp-1#user-1',
            sk: '2026-01-01T00:00:00Z',
            usageMetadata: item.usageMetadata,
          },
        ],
      });
      const restored = await findInvokeExAppHistory('team-1', 'exapp-1', 'user-1', '2026-01-01T00:00:00Z');

      // 復元された usageMetadata は estimatedCostInfo オブジェクトを保持（型修正の往復破綻なし）
      expect(restored.history?.usageMetadata).toEqual(sampleUsageMetadata);
      expect(restored.history?.usageMetadata?.[0].estimatedCostInfo).toEqual({
        estimatedCost: 0.123,
        currency: 'USD',
      });
    });
  });
});
