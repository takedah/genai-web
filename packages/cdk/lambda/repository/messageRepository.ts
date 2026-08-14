import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RecordedMessage, ToBeRecordedMessage } from 'genai-web';
import { dynamoDbDocument, TABLE_NAME, TTL_DAYS } from './client';

// フロントは GET /chats/:chatId/messages で全件を一括取得する設計のため、
// 他リポジトリのような cursor-based pagination ではなくサーバー側で全ページを収集する。
export const listMessages = async (_chatId: string): Promise<RecordedMessage[]> => {
  const chatId = `chat#${_chatId}`;
  const items: RecordedMessage[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const res = await dynamoDbDocument.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: '#id = :id',
        ExpressionAttributeNames: {
          '#id': 'id',
        },
        ExpressionAttributeValues: {
          ':id': chatId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );
    items.push(...(res.Items as RecordedMessage[]));
    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey !== undefined);

  return items;
};

export const batchCreateMessages = async (
  messages: ToBeRecordedMessage[],
  _userId: string,
  _chatId: string,
): Promise<RecordedMessage[]> => {
  const userId = `user#${_userId}`;
  const chatId = `chat#${_chatId}`;
  const createdDate = Date.now();
  const feedback = 'none';
  const expire_at = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

  const items: RecordedMessage[] = messages.map((m: ToBeRecordedMessage, i: number) => {
    // 配列が存在し非空のときだけ Item に含める。金額値（number 型）はそのまま DDB に保存される。
    const usageCostHistory =
      Array.isArray(m.usageCostHistory) && m.usageCostHistory.length > 0
        ? m.usageCostHistory
        : undefined;
    return {
      id: chatId,
      createdDate: m.createdDate ?? `${createdDate + i}#0`,
      messageId: m.messageId,
      role: m.role,
      content: m.content,
      trace: m.trace,
      extraData: m.extraData,
      userId,
      feedback,
      usecase: m.usecase,
      llmType: m.llmType ?? '',
      expire_at,
      ...(usageCostHistory !== undefined ? { usageCostHistory } : {}),
    };
  });
  await dynamoDbDocument.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: items.map((m) => {
          return {
            PutRequest: {
              Item: m,
            },
          };
        }),
      },
    }),
  );

  return items;
};
