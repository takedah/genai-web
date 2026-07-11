import { Logger } from '@aws-lambda-powertools/logger';
import {
  getPasswordResetUserEmail,
  setPasswordResetUserPassword,
  signOutPasswordResetUser,
} from './passwordReset/cognito';
import { escapeHtml, sha256Hex, verifyVerificationCode } from './passwordReset/utils';
import {
  consumePasswordResetRecord,
  listPasswordResetRecordsByEmailHash,
  PasswordResetRecord,
  recordPasswordResetVerificationFailure,
} from './repository/passwordResetRepository';
import {
  CompleteResetSubmission,
  completePasswordResetSchema,
  PASSWORD_POLICY_ERROR_MESSAGE,
} from './schemas/completePasswordResetSchema';
import { createApiHandler } from './utils/createApiHandler';
import { HttpError } from './utils/httpError';
import { parseJsonBody } from './utils/parseJsonBody';
import { sendEmail } from './utils/sesApi';

const logger = new Logger({ serviceName: 'passwordResetComplete' });

export const PASSWORD_RESET_COMPLETE_SUCCESS_MESSAGE =
  'パスワードを更新しました。新しいパスワードでサインインしてください。';
export const PASSWORD_RESET_INVALID_CODE_MESSAGE =
  '認証コードが正しくないか、有効期限が切れています。';
export const PASSWORD_RESET_UPDATE_FAILED_MESSAGE =
  'パスワードを更新できませんでした。再度パスワード再設定をお試しください。';

const PASSWORD_RESET_MAX_ATTEMPTS = 5;

const parseResetSubmission = (body: string | null): CompleteResetSubmission => {
  const parsed = parseJsonBody(body);
  const result = completePasswordResetSchema.safeParse(parsed);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? '入力内容が不正です。');
  }
  return result.data;
};

const buildPasswordResetCompleteEmail = (): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} => {
  const subject = 'パスワード変更完了';
  const escapedSubject = escapeHtml(subject);
  return {
    subject,
    bodyHtml: `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="max-width:480px;margin:0 auto;color:#333333;font-size:16px;padding:24px;">
  <h1>${escapedSubject}</h1>
  <p style="margin-top:16px;">パスワードが変更されました。</p>
  <p style="margin-top:8px;">この変更に心当たりがない場合は、管理者へ連絡してください。</p>
</body>
</html>`,
    bodyText: [
      'パスワードが変更されました。',
      '',
      'この変更に心当たりがない場合は、管理者へ連絡してください。',
    ].join('\n'),
  };
};

const createInvalidCodeError = (
  event:
    | 'code_not_found'
    | 'code_mismatch'
    | 'attempt_limit_exceeded'
    | 'verification_record_missing'
    | 'code_already_consumed',
  details: Record<string, unknown> = {},
): HttpError => {
  logger.info('Password reset code rejected', {
    event,
    ...details,
  });
  return new HttpError(400, PASSWORD_RESET_INVALID_CODE_MESSAGE);
};

const isPasswordPolicyRejectedByCognito = (error: unknown): error is Error =>
  error instanceof Error &&
  (error.name === 'InvalidPasswordException' || error.name === 'InvalidParameterException');

const selectValidRecord = (records: PasswordResetRecord[]): PasswordResetRecord => {
  const now = Math.floor(Date.now() / 1000);
  const record = records.find(
    (item) => item.expiresAt > now && item.attemptCount < PASSWORD_RESET_MAX_ATTEMPTS,
  );
  if (!record) {
    throw createInvalidCodeError('code_not_found');
  }

  return record;
};

const assertVerificationCode = async (
  record: PasswordResetRecord,
  confirmationCode: string,
): Promise<void> => {
  const isValid = await verifyVerificationCode(confirmationCode, record.codeSalt, record.codeHash);
  if (isValid) {
    return;
  }

  const failureResult = await recordPasswordResetVerificationFailure(
    record.recordId,
    PASSWORD_RESET_MAX_ATTEMPTS,
  );

  if (failureResult === 'exceeded') {
    throw createInvalidCodeError('attempt_limit_exceeded', {
      recordId: record.recordId,
    });
  }
  if (failureResult === 'missing') {
    throw createInvalidCodeError('verification_record_missing', {
      recordId: record.recordId,
    });
  }

  throw createInvalidCodeError('code_mismatch', {
    recordId: record.recordId,
  });
};

const sendCompletionNotification = async (record: PasswordResetRecord): Promise<void> => {
  try {
    const userEmail = await getPasswordResetUserEmail(record.cognitoUsername);
    if (!userEmail) {
      logger.warn('Password reset completion notification skipped because email was missing', {
        event: 'notification_email_missing',
        recordId: record.recordId,
      });
      return;
    }
    if (!userEmail.emailVerified) {
      logger.warn('Password reset completion notification skipped because email was unverified', {
        event: 'notification_email_unverified',
        recordId: record.recordId,
      });
      return;
    }

    const emailContent = buildPasswordResetCompleteEmail();
    await sendEmail(
      userEmail.email,
      emailContent.subject,
      emailContent.bodyHtml,
      emailContent.bodyText,
      process.env.SES_CONFIGURATION_SET_NAME,
    );
  } catch (error) {
    logger.error('Password reset completion notification delivery failed', {
      event: 'notification_delivery_failed',
      recordId: record.recordId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
};

const processPasswordResetComplete = async (submission: CompleteResetSubmission): Promise<void> => {
  const emailHash = sha256Hex(submission.email);
  const record = selectValidRecord(await listPasswordResetRecordsByEmailHash(emailHash));
  await assertVerificationCode(record, submission.confirmationCode);

  const consumed = await consumePasswordResetRecord(record.recordId);
  if (!consumed) {
    throw createInvalidCodeError('code_already_consumed', {
      recordId: record.recordId,
    });
  }

  try {
    await signOutPasswordResetUser(record.cognitoUsername);
  } catch (error) {
    logger.error('Password reset global sign-out failed', {
      event: 'global_signout_failed',
      recordId: record.recordId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new HttpError(500, PASSWORD_RESET_UPDATE_FAILED_MESSAGE);
  }

  try {
    await setPasswordResetUserPassword(record.cognitoUsername, submission.newPassword);
  } catch (error) {
    if (isPasswordPolicyRejectedByCognito(error)) {
      logger.warn('Password reset password was rejected by Cognito policy', {
        event: 'password_policy_rejected_by_cognito',
        recordId: record.recordId,
        errorName: error.name,
      });
      throw new HttpError(400, PASSWORD_POLICY_ERROR_MESSAGE);
    }

    logger.error('Password reset password update failed', {
      event: 'password_update_failed',
      recordId: record.recordId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new HttpError(500, PASSWORD_RESET_UPDATE_FAILED_MESSAGE);
  }

  await sendCompletionNotification(record);
  logger.info('Password reset completed', {
    event: 'completed',
    recordId: record.recordId,
  });
};

export const handler = createApiHandler(async (event) => {
  const submission = parseResetSubmission(event.body);
  await processPasswordResetComplete(submission);

  return {
    statusCode: 200,
    body: {
      message: PASSWORD_RESET_COMPLETE_SUCCESS_MESSAGE,
    },
  };
});
