// client.ts は import 時に process.env.TABLE_NAME を解決するため、
// vi.hoisted で import 前に env を設定する。
import { vi } from 'vitest';
vi.hoisted(() => {
  process.env.TABLE_NAME = 'test-table';
  process.env.TTL_DAYS = '30';
});

import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import type { ToBeRecordedMessage, UsageCostEntry } from 'genai-web';
import { beforeEach, describe, expect, it } from 'vitest';
import { batchCreateMessages } from '../../../lambda/repository/messageRepository';
import { TABLE_NAME } from '../../../lambda/repository/client';

const ddbMock = mockClient(DynamoDBDocumentClient);

const baseMessage: ToBeRecordedMessage = {
  role: 'assistant',
  content: 'hello',
  messageId: 'msg-1',
  usecase: '/chat',
};

const usageEntry: UsageCostEntry = {
  usage: {
    model: 'jp.anthropic.claude-sonnet-4-6',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
  },
  estimatedCost: { totalCost: 0.01155, currency: 'USD' },
};

describe('messageRepository.batchCreateMessages', () => {
  beforeEach(() => {
    ddbMock.reset();
    ddbMock.on(BatchWriteCommand).resolves({});
  });

  const getPutItems = (): Record<string, unknown>[] => {
    const calls = ddbMock.commandCalls(BatchWriteCommand);
    expect(calls.length).toBeGreaterThan(0);
    const requestItems = calls[0].args[0].input.RequestItems!;
    // import 時に解決された TABLE_NAME を使う（テスト env 反映の保証）。
    const tableRequests = requestItems[TABLE_NAME] as { PutRequest?: { Item: Record<string, unknown> } }[];
    expect(tableRequests).toBeDefined();
    return tableRequests.map((r) => r.PutRequest!.Item);
  };

  it('usageCostHistory を含むメッセージは Item に当該フィールドが含まれる（金額は number 型）', async () => {
    const messages: ToBeRecordedMessage[] = [
      {
        ...baseMessage,
        usageCostHistory: [usageEntry],
      },
    ];
    await batchCreateMessages(messages, 'user-1', 'chat-1');

    const items = getPutItems();
    expect(items[0].usageCostHistory).toEqual([usageEntry]);
    // 金額は number 型のまま保持
    const history = items[0].usageCostHistory as UsageCostEntry[];
    expect(typeof history[0].estimatedCost!.totalCost).toBe('number');
  });

  it('usageCostHistory が undefined の場合は属性ごと落として保存（後方互換）', async () => {
    const messages: ToBeRecordedMessage[] = [{ ...baseMessage }];
    await batchCreateMessages(messages, 'user-1', 'chat-1');

    const items = getPutItems();
    expect('usageCostHistory' in items[0]).toBe(false);
  });

  it('usageCostHistory が空配列の場合は属性ごと落として保存', async () => {
    const messages: ToBeRecordedMessage[] = [{ ...baseMessage, usageCostHistory: [] }];
    await batchCreateMessages(messages, 'user-1', 'chat-1');

    const items = getPutItems();
    expect('usageCostHistory' in items[0]).toBe(false);
  });

  it('複数 entry（continue/retry 想定）はすべて保存される', async () => {
    const second: UsageCostEntry = {
      usage: { ...usageEntry.usage, inputTokens: 200, outputTokens: 80, totalTokens: 280 },
      estimatedCost: { totalCost: 0.0198, currency: 'USD' },
    };
    const messages: ToBeRecordedMessage[] = [
      { ...baseMessage, usageCostHistory: [usageEntry, second] },
    ];
    await batchCreateMessages(messages, 'user-1', 'chat-1');

    const items = getPutItems();
    expect(items[0].usageCostHistory).toEqual([usageEntry, second]);
  });
});
