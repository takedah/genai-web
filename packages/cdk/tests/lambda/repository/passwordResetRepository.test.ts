import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

const dynamoMock = mockClient(DynamoDBDocumentClient);
const originalEnv = process.env;

const loadRepository = async () => {
  vi.resetModules();
  return import('../../../lambda/repository/passwordResetRepository');
};

describe('passwordResetRepository', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env = {
      ...originalEnv,
      PASSWORD_RESET_TABLE_NAME: 'PasswordResetTable',
      EMAIL_HASH_INDEX_NAME: 'EmailHashIndex',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('emailHashに紐づく既存レコードを削除する', async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ recordId: 'record-id-1' }, { recordId: 'record-id-2' }],
    });
    dynamoMock.on(DeleteCommand).resolves({});
    const { deletePasswordResetRecordsByEmailHash } = await loadRepository();

    await deletePasswordResetRecordsByEmailHash('email-hash');

    expect(dynamoMock.commandCalls(QueryCommand)[0].args[0].input).toEqual({
      TableName: 'PasswordResetTable',
      IndexName: 'EmailHashIndex',
      KeyConditionExpression: 'emailHash = :emailHash',
      ExpressionAttributeValues: {
        ':emailHash': 'email-hash',
      },
      ProjectionExpression: 'recordId',
    });
    expect(dynamoMock.commandCalls(DeleteCommand).map((call) => call.args[0].input.Key)).toEqual([
      { recordId: 'record-id-1' },
      { recordId: 'record-id-2' },
    ]);
  });

  test('5分TTLのリセットレコードを保存する', async () => {
    dynamoMock.on(PutCommand).resolves({});
    const { putPasswordResetRecord } = await loadRepository();
    const record = {
      recordId: 'record-id',
      emailHash: 'email-hash',
      codeHash: 'code-hash',
      codeSalt: 'code-salt',
      cognitoUsername: 'username',
      cognitoSub: 'sub-123',
      attemptCount: 0,
      requestedAt: 1779408000,
      expiresAt: 1779408300,
    };

    await putPasswordResetRecord(record);

    expect(dynamoMock.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: 'PasswordResetTable',
      Item: record,
    });
  });

  test('emailHashからリセットレコードを取得する', async () => {
    const record = {
      recordId: 'record-id',
      emailHash: 'email-hash',
      codeHash: 'code-hash',
      codeSalt: 'code-salt',
      cognitoUsername: 'username',
      cognitoSub: 'sub-123',
      attemptCount: 0,
      requestedAt: 1779408000,
      expiresAt: 1779408300,
    };
    dynamoMock.on(QueryCommand).resolves({ Items: [record] });
    const { listPasswordResetRecordsByEmailHash } = await loadRepository();

    await expect(listPasswordResetRecordsByEmailHash('email-hash')).resolves.toEqual([record]);

    expect(dynamoMock.commandCalls(QueryCommand)[0].args[0].input).toEqual({
      TableName: 'PasswordResetTable',
      IndexName: 'EmailHashIndex',
      KeyConditionExpression: 'emailHash = :emailHash',
      ExpressionAttributeValues: {
        ':emailHash': 'email-hash',
      },
      ScanIndexForward: false,
    });
  });

  test('条件付きDeleteでリセットレコードを消費する', async () => {
    dynamoMock.on(DeleteCommand).resolves({});
    const { consumePasswordResetRecord } = await loadRepository();

    await expect(consumePasswordResetRecord('record-id')).resolves.toBe(true);

    expect(dynamoMock.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: 'PasswordResetTable',
      Key: {
        recordId: 'record-id',
      },
      ConditionExpression: 'attribute_exists(recordId)',
    });
  });

  test('条件付きDeleteが失敗した場合はfalseを返す', async () => {
    const conditionalError = new Error('condition failed');
    conditionalError.name = 'ConditionalCheckFailedException';
    dynamoMock.on(DeleteCommand).rejects(conditionalError);
    const { consumePasswordResetRecord } = await loadRepository();

    await expect(consumePasswordResetRecord('record-id')).resolves.toBe(false);
  });

  test('認証コード失敗回数を加算し、上限未満ではretryableを返す', async () => {
    dynamoMock.on(UpdateCommand).resolves({ Attributes: { attemptCount: 3 } });
    const { recordPasswordResetVerificationFailure } = await loadRepository();

    await expect(recordPasswordResetVerificationFailure('record-id', 5)).resolves.toBe(
      'retryable',
    );

    expect(dynamoMock.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      TableName: 'PasswordResetTable',
      Key: { recordId: 'record-id' },
      ConditionExpression: 'attribute_exists(recordId)',
      UpdateExpression: 'SET attemptCount = if_not_exists(attemptCount, :zero) + :one',
      ReturnValues: 'ALL_NEW',
    });
  });

  test('認証コード失敗回数が上限に達した場合はレコードを削除する', async () => {
    dynamoMock.on(UpdateCommand).resolves({ Attributes: { attemptCount: 5 } });
    dynamoMock.on(DeleteCommand).resolves({});
    const { recordPasswordResetVerificationFailure } = await loadRepository();

    await expect(recordPasswordResetVerificationFailure('record-id', 5)).resolves.toBe(
      'exceeded',
    );
    expect(dynamoMock.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({
      recordId: 'record-id',
    });
  });
});
