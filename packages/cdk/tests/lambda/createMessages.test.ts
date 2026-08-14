import { vi } from 'vitest';
vi.hoisted(() => {
  process.env.BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'ap-northeast-1';
  process.env.TABLE_NAME = 'test-table';
  process.env.TTL_DAYS = '30';
});

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { handler, sanitizeUsageCostHistory } from '../../lambda/createMessages';

const ddbMock = mockClient(DynamoDBDocumentClient);

const makeEvent = (body: object): APIGatewayProxyEvent =>
  ({
    body: JSON.stringify(body),
    pathParameters: { chatId: 'chat-1' },
    requestContext: { authorizer: { claims: { sub: 'user-1' } } },
  }) as unknown as APIGatewayProxyEvent;

describe('handler: content size guard', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('400KB 以下の content は正常に処理される', async () => {
    const { QueryCommand, BatchWriteCommand } = await import('@aws-sdk/lib-dynamodb');
    ddbMock.on(QueryCommand).resolves({ Items: [{ id: 'user#user-1', chatId: 'chat-1' }] });
    ddbMock.on(BatchWriteCommand).resolves({});

    const content = 'a'.repeat(400 * 1024);
    const event = makeEvent({ messages: [{ role: 'user', content, messageId: 'msg-1', usecase: '/chat' }] });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });

  it('400KB 超の content は 400 を返す', async () => {
    const content = 'a'.repeat(400 * 1024 + 1);
    const event = makeEvent({ messages: [{ role: 'user', content, messageId: 'msg-1', usecase: '/chat' }] });

    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    ddbMock.on(QueryCommand).resolves({ Items: [{ id: 'user#user-1', chatId: 'chat-1' }] });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe(
      'メッセージの内容が大きすぎます。内容を短くしてから送信してください。',
    );
  });

  it('マルチバイト文字で 400KB 超になる場合も 400 を返す', async () => {
    // 日本語1文字=3バイト。400KB+1バイト超になる文字数を用意する
    const content = 'あ'.repeat(Math.ceil((400 * 1024 + 1) / 3));
    const event = makeEvent({ messages: [{ role: 'user', content, messageId: 'msg-1', usecase: '/chat' }] });

    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    ddbMock.on(QueryCommand).resolves({ Items: [{ id: 'user#user-1', chatId: 'chat-1' }] });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
  });
});

const validUsage = {
  model: 'jp.anthropic.claude-sonnet-4-6',
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
};

describe('sanitizeUsageCostHistory', () => {
  it('undefined / null / 配列以外は undefined を返す（属性ごと落とす）', () => {
    expect(sanitizeUsageCostHistory(undefined)).toBeUndefined();
    expect(sanitizeUsageCostHistory(null)).toBeUndefined();
    expect(sanitizeUsageCostHistory({ usage: validUsage })).toBeUndefined();
    expect(sanitizeUsageCostHistory('not an array')).toBeUndefined();
  });

  it('空配列は undefined を返す', () => {
    expect(sanitizeUsageCostHistory([])).toBeUndefined();
  });

  it('正常な entry はそのまま採用される', () => {
    const entries = [
      { usage: validUsage },
      {
        usage: validUsage,
        estimatedCost: { totalCost: 0.01, currency: 'USD' },
      },
    ];
    expect(sanitizeUsageCostHistory(entries)).toEqual(entries);
  });

  it('usage の必須フィールド欠落エントリは除外される', () => {
    const result = sanitizeUsageCostHistory([
      { usage: validUsage },
      { usage: { ...validUsage, model: '' } }, // 空 model はリジェクト
      { usage: { ...validUsage, inputTokens: '100' } }, // 数値以外
      { usage: { ...validUsage, totalTokens: Number.NaN } }, // NaN
      {}, // usage 欠落
      null, // 非オブジェクト
    ]);
    expect(result).toEqual([{ usage: validUsage }]);
  });

  it('全エントリが不正なら undefined を返す（属性ごと落とす）', () => {
    const result = sanitizeUsageCostHistory([
      { usage: { model: 'x' } },
      'not an object',
      null,
    ]);
    expect(result).toBeUndefined();
  });
});
