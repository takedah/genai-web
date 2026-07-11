import { createHash } from 'node:crypto';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

interface CapturedLog {
  level: 'INFO' | 'WARN' | 'ERROR';
  extra: Record<string, unknown>;
}

let captured: CapturedLog[] = [];
import type { PasswordResetRecord } from '../../lambda/repository/passwordResetRepository';

const {
  mockConsumePasswordResetRecord,
  mockGetPasswordResetUserEmail,
  mockListPasswordResetRecordsByEmailHash,
  mockRecordPasswordResetVerificationFailure,
  mockSendEmail,
  mockSetPasswordResetUserPassword,
  mockSignOutPasswordResetUser,
  mockVerifyVerificationCode,
} = vi.hoisted(() => ({
  mockConsumePasswordResetRecord: vi.fn(),
  mockGetPasswordResetUserEmail: vi.fn(),
  mockListPasswordResetRecordsByEmailHash: vi.fn(),
  mockRecordPasswordResetVerificationFailure: vi.fn(),
  mockSendEmail: vi.fn(),
  mockSetPasswordResetUserPassword: vi.fn(),
  mockSignOutPasswordResetUser: vi.fn(),
  mockVerifyVerificationCode: vi.fn(),
}));

vi.mock('@aws-lambda-powertools/logger', () => {
  class Logger {
    info(_message: string, extra: Record<string, unknown> = {}) {
      captured.push({ level: 'INFO', extra });
    }
    warn(_message: string, extra: Record<string, unknown> = {}) {
      captured.push({ level: 'WARN', extra });
    }
    error(_message: string, extra: Record<string, unknown> = {}) {
      captured.push({ level: 'ERROR', extra });
    }
  }
  return { Logger };
});

vi.mock('../../lambda/repository/passwordResetRepository', () => ({
  consumePasswordResetRecord: mockConsumePasswordResetRecord,
  listPasswordResetRecordsByEmailHash: mockListPasswordResetRecordsByEmailHash,
  recordPasswordResetVerificationFailure: mockRecordPasswordResetVerificationFailure,
}));

vi.mock('../../lambda/passwordReset/cognito', () => ({
  getPasswordResetUserEmail: mockGetPasswordResetUserEmail,
  setPasswordResetUserPassword: mockSetPasswordResetUserPassword,
  signOutPasswordResetUser: mockSignOutPasswordResetUser,
}));

vi.mock('../../lambda/utils/sesApi', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('../../lambda/passwordReset/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lambda/passwordReset/utils')>();
  return {
    ...actual,
    verifyVerificationCode: mockVerifyVerificationCode,
  };
});

import {
  handler,
  PASSWORD_RESET_COMPLETE_SUCCESS_MESSAGE,
  PASSWORD_RESET_INVALID_CODE_MESSAGE,
  PASSWORD_RESET_UPDATE_FAILED_MESSAGE,
} from '../../lambda/completePasswordReset';
import { PASSWORD_POLICY_ERROR_MESSAGE } from '../../lambda/schemas/completePasswordResetSchema';

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
const email = 'user@example.go.jp';
const emailHash = sha256Hex(email);
const confirmationCode = '123456';
const newPassword = 'NewPassword!234';
const recordId = 'record-id';

const createEvent = (body: unknown): APIGatewayProxyEvent =>
  ({
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as APIGatewayProxyEvent;

const expectError = (
  result: { statusCode: number; body: string },
  statusCode: number,
  message: string,
) => {
  expect(result.statusCode).toBe(statusCode);
  expect(JSON.parse(result.body)).toEqual({ error: message });
};

const validRecord: PasswordResetRecord = {
  recordId,
  emailHash,
  codeHash: 'code-hash',
  codeSalt: 'code-salt',
  cognitoUsername: 'cognito-username',
  cognitoSub: 'sub-123',
  attemptCount: 0,
  requestedAt: 1779408000,
  expiresAt: 1779408300,
};

const validBody = {
  email,
  confirmationCode,
  newPassword,
  confirmPassword: newPassword,
};

describe('completePasswordReset handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    captured = [];
    vi.resetAllMocks();
    process.env.SES_CONFIGURATION_SET_NAME = 'reset-config';
    mockListPasswordResetRecordsByEmailHash.mockResolvedValue([validRecord]);
    mockVerifyVerificationCode.mockResolvedValue(true);
    mockRecordPasswordResetVerificationFailure.mockResolvedValue('retryable');
    mockConsumePasswordResetRecord.mockResolvedValue(true);
    mockSetPasswordResetUserPassword.mockResolvedValue(undefined);
    mockSignOutPasswordResetUser.mockResolvedValue(undefined);
    mockGetPasswordResetUserEmail.mockResolvedValue({
      email: 'registered@example.go.jp',
      emailVerified: true,
    });
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SES_CONFIGURATION_SET_NAME;
  });

  test('valid codeでパスワードを更新し、record削除・global sign-out・完了通知を行う', async () => {
    const result = await handler(createEvent(validBody));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      message: PASSWORD_RESET_COMPLETE_SUCCESS_MESSAGE,
    });
    expect(mockListPasswordResetRecordsByEmailHash).toHaveBeenCalledWith(emailHash);
    expect(mockVerifyVerificationCode).toHaveBeenCalledWith(
      confirmationCode,
      'code-salt',
      'code-hash',
    );
    expect(mockConsumePasswordResetRecord).toHaveBeenCalledWith(recordId);
    expect(mockSetPasswordResetUserPassword).toHaveBeenCalledWith(
      'cognito-username',
      newPassword,
    );
    expect(mockSignOutPasswordResetUser).toHaveBeenCalledWith('cognito-username');
    expect(mockSendEmail).toHaveBeenCalledWith(
      'registered@example.go.jp',
      'パスワード変更完了',
      expect.stringContaining('パスワードが変更されました。'),
      expect.stringContaining('この変更に心当たりがない場合'),
      'reset-config',
    );
    expect(mockConsumePasswordResetRecord.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOutPasswordResetUser.mock.invocationCallOrder[0],
    );
    expect(mockSignOutPasswordResetUser.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetPasswordResetUserPassword.mock.invocationCallOrder[0],
    );
  });

  test('期限切れcodeはrecordを消費せず400を返す', async () => {
    mockListPasswordResetRecordsByEmailHash.mockResolvedValue([
      {
        ...validRecord,
        expiresAt: 1779408000,
      },
    ]);

    const result = await handler(createEvent(validBody));

    expectError(result, 400, PASSWORD_RESET_INVALID_CODE_MESSAGE);
    expect(mockConsumePasswordResetRecord).not.toHaveBeenCalled();
    expect(mockSetPasswordResetUserPassword).not.toHaveBeenCalled();
  });

  test('存在しないcodeは400を返す', async () => {
    mockListPasswordResetRecordsByEmailHash.mockResolvedValue([]);

    const result = await handler(createEvent(validBody));

    expectError(result, 400, PASSWORD_RESET_INVALID_CODE_MESSAGE);
    expect(mockConsumePasswordResetRecord).not.toHaveBeenCalled();
    expect(mockSetPasswordResetUserPassword).not.toHaveBeenCalled();
  });

  test('認証コード不一致は失敗回数を加算して400を返す', async () => {
    mockVerifyVerificationCode.mockResolvedValue(false);

    const result = await handler(createEvent(validBody));

    expectError(result, 400, PASSWORD_RESET_INVALID_CODE_MESSAGE);
    expect(mockRecordPasswordResetVerificationFailure).toHaveBeenCalledWith(recordId, 5);
    expect(mockConsumePasswordResetRecord).not.toHaveBeenCalled();
    expect(mockSetPasswordResetUserPassword).not.toHaveBeenCalled();
  });

  test('並行使用でcode消費に失敗した場合は400を返す', async () => {
    mockConsumePasswordResetRecord.mockResolvedValue(false);

    const result = await handler(createEvent(validBody));

    expectError(result, 400, PASSWORD_RESET_INVALID_CODE_MESSAGE);
    expect(mockSetPasswordResetUserPassword).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('確認用パスワード不一致はDynamoDBを読まず400を返す', async () => {
    const result = await handler(
      createEvent({ ...validBody, confirmPassword: 'Different!234' }),
    );

    expectError(result, 400, '確認用パスワードが一致しません。');
    expect(mockListPasswordResetRecordsByEmailHash).not.toHaveBeenCalled();
  });

  test('password policy違反はDynamoDBを読まず400を返す', async () => {
    const weakPassword = 'PASSWORD!234';

    const result = await handler(
      createEvent({ ...validBody, newPassword: weakPassword, confirmPassword: weakPassword }),
    );

    expectError(result, 400, PASSWORD_POLICY_ERROR_MESSAGE);
    expect(mockListPasswordResetRecordsByEmailHash).not.toHaveBeenCalled();
  });

  test('空文字のパスワードもpassword policy違反として400を返す', async () => {
    const result = await handler(
      createEvent({ ...validBody, newPassword: '', confirmPassword: 'Different!234' }),
    );

    expectError(result, 400, PASSWORD_POLICY_ERROR_MESSAGE);
    expect(mockListPasswordResetRecordsByEmailHash).not.toHaveBeenCalled();
  });

  test('全角記号はCognito準拠の記号として扱わず400を返す', async () => {
    const passwordWithFullWidthSymbol = 'NewPassword1！';

    const result = await handler(
      createEvent({
        ...validBody,
        newPassword: passwordWithFullWidthSymbol,
        confirmPassword: passwordWithFullWidthSymbol,
      }),
    );

    expectError(result, 400, PASSWORD_POLICY_ERROR_MESSAGE);
    expect(mockListPasswordResetRecordsByEmailHash).not.toHaveBeenCalled();
  });

  test('Cognitoがpassword policy違反を返した場合は400に変換する', async () => {
    const error = new Error('Password rejected');
    error.name = 'InvalidPasswordException';
    mockSetPasswordResetUserPassword.mockRejectedValue(error);

    const result = await handler(createEvent(validBody));

    expectError(result, 400, PASSWORD_POLICY_ERROR_MESSAGE);
    expect(mockConsumePasswordResetRecord).toHaveBeenCalledWith(recordId);
    expect(mockSignOutPasswordResetUser).toHaveBeenCalledWith('cognito-username');
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(captured.find((log) => log.extra.event === 'password_policy_rejected_by_cognito')?.extra)
      .toMatchObject({
        recordId,
        errorName: 'InvalidPasswordException',
      });
  });

  test('Cognito password更新失敗時はcode消費後に500を返す', async () => {
    mockSetPasswordResetUserPassword.mockRejectedValue(new Error('Cognito failed'));

    const result = await handler(createEvent(validBody));

    expectError(result, 500, PASSWORD_RESET_UPDATE_FAILED_MESSAGE);
    expect(mockConsumePasswordResetRecord).toHaveBeenCalledWith(recordId);
    expect(mockSignOutPasswordResetUser).toHaveBeenCalledWith('cognito-username');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('global sign-out失敗時はパスワードを更新せず500を返す', async () => {
    mockSignOutPasswordResetUser.mockRejectedValue(new Error('SignOut failed'));

    const result = await handler(createEvent(validBody));

    expectError(result, 500, PASSWORD_RESET_UPDATE_FAILED_MESSAGE);
    expect(mockSetPasswordResetUserPassword).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('通知先emailが未検証の場合は通知を送らず200を返す', async () => {
    mockGetPasswordResetUserEmail.mockResolvedValue({
      email: 'registered@example.go.jp',
      emailVerified: false,
    });

    const result = await handler(createEvent(validBody));

    expect(result.statusCode).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('通知メール送信失敗時もパスワード更新成功として200を返す', async () => {
    mockSendEmail.mockRejectedValue(new Error('SES failed'));

    const result = await handler(createEvent(validBody));

    expect(result.statusCode).toBe(200);
    expect(mockSetPasswordResetUserPassword).toHaveBeenCalled();
  });

  test('powertools loggerを使い、confirmation codeやcognitoSubをログに出さない', async () => {
    await handler(createEvent(validBody));

    const completed = captured.find((log) => log.extra.event === 'completed');
    expect(completed).toBeDefined();
    expect(completed?.extra).toMatchObject({
      recordId,
    });

    const serializedLogs = JSON.stringify(captured.map((log) => log.extra));
    expect(serializedLogs).not.toContain(confirmationCode);
    expect(serializedLogs).not.toContain(newPassword);
    expect(serializedLogs).not.toContain(email);
    expect(serializedLogs).not.toContain('registered@example.go.jp');
    expect(serializedLogs).not.toContain(emailHash);
    expect(serializedLogs).not.toContain('sub-123');
    expect(serializedLogs).not.toContain('cognitoSub');
  });
});
