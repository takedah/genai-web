import { createHash } from 'node:crypto';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

interface CapturedLog {
  level: 'INFO' | 'WARN' | 'ERROR';
  extra: Record<string, unknown>;
}

let captured: CapturedLog[] = [];

const {
  mockDeletePasswordResetRecord,
  mockDeletePasswordResetRecordsByEmailHash,
  mockFindPasswordResetTargetUserByEmail,
  mockPutPasswordResetRecord,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockDeletePasswordResetRecord: vi.fn(),
  mockDeletePasswordResetRecordsByEmailHash: vi.fn(),
  mockFindPasswordResetTargetUserByEmail: vi.fn(),
  mockPutPasswordResetRecord: vi.fn(),
  mockSendEmail: vi.fn(),
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
  deletePasswordResetRecord: mockDeletePasswordResetRecord,
  deletePasswordResetRecordsByEmailHash: mockDeletePasswordResetRecordsByEmailHash,
  putPasswordResetRecord: mockPutPasswordResetRecord,
}));

vi.mock('../../lambda/passwordReset/cognito', () => ({
  findPasswordResetTargetUserByEmail: mockFindPasswordResetTargetUserByEmail,
}));

vi.mock('../../lambda/utils/sesApi', () => ({
  sendEmail: mockSendEmail,
}));

import { handler } from '../../lambda/requestPasswordReset';

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

const createEvent = (body: unknown): APIGatewayProxyEvent =>
  ({
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as APIGatewayProxyEvent;

const expectGenericSuccess = (result: { statusCode: number; body: string }) => {
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual({});
};

describe('requestPasswordReset handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    captured = [];
    vi.resetAllMocks();
    process.env.PASSWORD_RESET_MIN_RESPONSE_MS = '0';
    process.env.SES_CONFIGURATION_SET_NAME = 'reset-config';
    mockDeletePasswordResetRecordsByEmailHash.mockResolvedValue(undefined);
    mockPutPasswordResetRecord.mockResolvedValue(undefined);
    mockDeletePasswordResetRecord.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PASSWORD_RESET_MIN_RESPONSE_MS;
    delete process.env.SES_CONFIGURATION_SET_NAME;
  });

  test('対象ユーザーに6桁コードのリセットメールを送信し、5分TTLのレコードを保存する', async () => {
    const email = 'User+Tag@Example.go.jp';
    mockFindPasswordResetTargetUserByEmail.mockResolvedValue({
      username: 'cognito-username',
      cognitoSub: 'sub-123',
      email: 'registered@example.go.jp',
    });

    const result = await handler(createEvent({ email }));

    expectGenericSuccess(result);
    const expectedEmailHash = sha256Hex(email);
    expect(mockDeletePasswordResetRecordsByEmailHash).toHaveBeenCalledWith(expectedEmailHash);
    expect(mockFindPasswordResetTargetUserByEmail).toHaveBeenCalledWith(email);

    expect(mockPutPasswordResetRecord).toHaveBeenCalledWith({
      recordId: expect.any(String),
      emailHash: expectedEmailHash,
      codeHash: expect.any(String),
      codeSalt: expect.any(String),
      cognitoUsername: 'cognito-username',
      cognitoSub: 'sub-123',
      attemptCount: 0,
      requestedAt: 1779408000,
      expiresAt: 1779408300,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      'registered@example.go.jp',
      'パスワード再設定',
      expect.stringContaining('この認証コードの有効期限は5分です。'),
      expect.stringContaining('この認証コードの有効期限は5分です。'),
      'reset-config',
    );

    const bodyHtml = mockSendEmail.mock.calls[0][2] as string;
    expect(bodyHtml).toContain(
      'margin-top:8px;padding:8px 16px;font-size:32px;font-weight:bold;background-color:#f2f2f2;letter-spacing:8px;',
    );

    const bodyText = mockSendEmail.mock.calls[0][3] as string;
    const verificationCode = bodyText.split('\n').find((line) => /^\d{6}$/.test(line));
    expect(verificationCode).toBeDefined();
    expect(mockDeletePasswordResetRecord).not.toHaveBeenCalled();
  });

  test('未登録または対象外ユーザーでも固定成功レスポンスを返す', async () => {
    const email = 'missing@example.go.jp';
    mockFindPasswordResetTargetUserByEmail.mockResolvedValue(undefined);

    const result = await handler(createEvent({ email }));

    expectGenericSuccess(result);
    expect(mockDeletePasswordResetRecordsByEmailHash).not.toHaveBeenCalled();
    expect(mockPutPasswordResetRecord).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('不正なemailでも固定成功レスポンスを返し、外部APIを呼ばない', async () => {
    const result = await handler(createEvent({ email: ' user@example.go.jp ' }));

    expectGenericSuccess(result);
    expect(mockDeletePasswordResetRecordsByEmailHash).not.toHaveBeenCalled();
    expect(mockFindPasswordResetTargetUserByEmail).not.toHaveBeenCalled();
    expect(mockPutPasswordResetRecord).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('minimum response floorを満たしてからレスポンスを返す', async () => {
    process.env.PASSWORD_RESET_MIN_RESPONSE_MS = '1000';
    let settled = false;

    const promise = handler(createEvent({ email: 'invalid-email' })).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expectGenericSuccess(await promise);
  });

  test('メール送信に失敗した場合は作成済みレコードを削除して固定成功レスポンスを返す', async () => {
    const email = 'user@example.go.jp';
    mockFindPasswordResetTargetUserByEmail.mockResolvedValue({
      username: 'cognito-username',
      cognitoSub: 'sub-123',
      email: 'registered@example.go.jp',
    });
    mockSendEmail.mockRejectedValue(new Error('SES failed'));

    const result = await handler(createEvent({ email }));

    expectGenericSuccess(result);
    const record = mockPutPasswordResetRecord.mock.calls[0][0];
    expect(mockDeletePasswordResetRecord).toHaveBeenCalledWith(record.recordId);
  });

  test('powertools loggerを使い、emailやcognitoSubをログに出さない', async () => {
    const email = 'user@example.go.jp';
    mockFindPasswordResetTargetUserByEmail.mockResolvedValue({
      username: 'cognito-username',
      cognitoSub: 'sub-123',
      email: 'registered@example.go.jp',
    });

    await handler(createEvent({ email }));

    const mailSent = captured.find((log) => log.extra.event === 'mail_sent');
    expect(mailSent).toBeDefined();
    expect(mailSent?.extra).toMatchObject({
      recordId: expect.any(String),
    });

    const serializedLogs = JSON.stringify(captured.map((log) => log.extra));
    expect(serializedLogs).not.toContain(email);
    expect(serializedLogs).not.toContain('registered@example.go.jp');
    expect(serializedLogs).not.toContain(sha256Hex(email));
    expect(serializedLogs).not.toContain('sub-123');
    expect(serializedLogs).not.toContain('cognitoSub');
  });
});
