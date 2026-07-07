import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbDocument } from './client';

const PASSWORD_RESET_TABLE_NAME = process.env.PASSWORD_RESET_TABLE_NAME!;
const EMAIL_HASH_INDEX_NAME = process.env.EMAIL_HASH_INDEX_NAME!;

export interface PasswordResetRecord {
  recordId: string;
  emailHash: string;
  codeHash: string;
  codeSalt: string;
  cognitoUsername: string;
  cognitoSub: string;
  attemptCount: number;
  requestedAt: number;
  expiresAt: number;
}

const isPasswordResetRecord = (item: unknown): item is PasswordResetRecord => {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const record = item as Record<string, unknown>;
  return (
    typeof record.recordId === 'string' &&
    typeof record.emailHash === 'string' &&
    typeof record.codeHash === 'string' &&
    typeof record.codeSalt === 'string' &&
    typeof record.cognitoUsername === 'string' &&
    typeof record.cognitoSub === 'string' &&
    typeof record.attemptCount === 'number' &&
    typeof record.requestedAt === 'number' &&
    typeof record.expiresAt === 'number'
  );
};

const isConditionalCheckFailed = (error: unknown): boolean =>
  error instanceof Error && error.name === 'ConditionalCheckFailedException';

export const listPasswordResetRecordsByEmailHash = async (
  emailHash: string,
): Promise<PasswordResetRecord[]> => {
  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: PASSWORD_RESET_TABLE_NAME,
      IndexName: EMAIL_HASH_INDEX_NAME,
      KeyConditionExpression: 'emailHash = :emailHash',
      ExpressionAttributeValues: {
        ':emailHash': emailHash,
      },
      ScanIndexForward: false,
    }),
  );

  return result.Items?.filter(isPasswordResetRecord) ?? [];
};

export const deletePasswordResetRecordsByEmailHash = async (emailHash: string): Promise<void> => {
  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: PASSWORD_RESET_TABLE_NAME,
      IndexName: EMAIL_HASH_INDEX_NAME,
      KeyConditionExpression: 'emailHash = :emailHash',
      ExpressionAttributeValues: {
        ':emailHash': emailHash,
      },
      ProjectionExpression: 'recordId',
    }),
  );

  const recordIds =
    result.Items?.map((item) => item.recordId).filter(
      (recordId): recordId is string => typeof recordId === 'string',
    ) ?? [];

  await Promise.all(recordIds.map((recordId) => deletePasswordResetRecord(recordId)));
};

export const putPasswordResetRecord = async (record: PasswordResetRecord): Promise<void> => {
  await dynamoDbDocument.send(
    new PutCommand({
      TableName: PASSWORD_RESET_TABLE_NAME,
      Item: record,
    }),
  );
};

export const deletePasswordResetRecord = async (recordId: string): Promise<void> => {
  await dynamoDbDocument.send(
    new DeleteCommand({
      TableName: PASSWORD_RESET_TABLE_NAME,
      Key: {
        recordId,
      },
    }),
  );
};

export const consumePasswordResetRecord = async (recordId: string): Promise<boolean> => {
  try {
    await dynamoDbDocument.send(
      new DeleteCommand({
        TableName: PASSWORD_RESET_TABLE_NAME,
        Key: {
          recordId,
        },
        ConditionExpression: 'attribute_exists(recordId)',
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      return false;
    }
    throw error;
  }
};

export const recordPasswordResetVerificationFailure = async (
  recordId: string,
  attemptLimit: number,
): Promise<'retryable' | 'exceeded' | 'missing'> => {
  try {
    const result = await dynamoDbDocument.send(
      new UpdateCommand({
        TableName: PASSWORD_RESET_TABLE_NAME,
        Key: {
          recordId,
        },
        ConditionExpression: 'attribute_exists(recordId)',
        UpdateExpression: 'SET attemptCount = if_not_exists(attemptCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    const attemptCount =
      typeof result.Attributes?.attemptCount === 'number' ? result.Attributes.attemptCount : 0;

    if (attemptCount >= attemptLimit) {
      await deletePasswordResetRecord(recordId);
      return 'exceeded';
    }

    return 'retryable';
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      return 'missing';
    }
    throw error;
  }
};
