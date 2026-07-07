import { Logger } from '@aws-lambda-powertools/logger';
import { findPasswordResetTargetUserByEmail } from './passwordReset/cognito';
import {
  escapeHtml,
  generateCodeSalt,
  generateResetRecordId,
  generateSixDigitCode,
  hashVerificationCode,
  sha256Hex,
} from './passwordReset/utils';
import {
  deletePasswordResetRecord,
  deletePasswordResetRecordsByEmailHash,
  putPasswordResetRecord,
} from './repository/passwordResetRepository';
import { requestPasswordResetSchema } from './schemas/requestPasswordResetSchema';
import { createApiHandler } from './utils/createApiHandler';
import { parseJsonBody } from './utils/parseJsonBody';
import { sendEmail } from './utils/sesApi';

const logger = new Logger({ serviceName: 'passwordResetRequest' });
const TOKEN_TTL_SECONDS = 300;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getMinimumResponseMs = (): number => {
  const parsed = Number.parseInt(process.env.PASSWORD_RESET_MIN_RESPONSE_MS ?? '500', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const parseEmail = (body: string | null): string | undefined => {
  try {
    const parsed = parseJsonBody(body);
    const result = requestPasswordResetSchema.safeParse(parsed);
    return result.success ? result.data.email : undefined;
  } catch {
    return undefined;
  }
};

const buildPasswordResetEmail = (
  verificationCode: string,
): { subject: string; bodyHtml: string; bodyText: string } => {
  const subject = 'パスワード再設定';
  const escapedVerificationCode = escapeHtml(verificationCode);
  return {
    subject,
    bodyHtml: `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="max-width:480px;margin:0 auto;color:#333333;font-size:16px;padding:24px;">
  <h1>${subject}</h1>
  <p style="margin-top:16px;">パスワード再設定を受け付けました。以下の認証コードを画面に入力し、新しいパスワードを設定してください。</p>
  <p style="margin-top:8px;padding:8px 16px;font-size:32px;font-weight:bold;background-color:#f2f2f2;letter-spacing:8px;">${escapedVerificationCode}</p>
  <p style="margin-top:16px;">この認証コードの有効期限は5分です。</p>
  <p style="margin-top:8px;">パスワード再設定を申請していない場合は、このメールを無視してください。</p>
</body>
</html>`,
    bodyText: [
      'パスワード再設定を受け付けました。以下の認証コードを画面に入力し、新しいパスワードを設定してください。',
      '',
      verificationCode,
      '',
      'この認証コードの有効期限は5分です。',
      'パスワード再設定を申請していない場合は、このメールを無視してください。',
    ].join('\n'),
  };
};

const processPasswordResetRequest = async (email: string): Promise<void> => {
  const emailHash = sha256Hex(email);
  const user = await findPasswordResetTargetUserByEmail(email);
  if (!user) {
    logger.info('Password reset target not eligible or not found', {
      event: 'target_not_eligible',
    });
    return;
  }

  await deletePasswordResetRecordsByEmailHash(emailHash);

  const verificationCode = generateSixDigitCode();
  const codeSalt = generateCodeSalt();
  const codeHash = await hashVerificationCode(verificationCode, codeSalt);
  const recordId = generateResetRecordId();
  const requestedAt = Math.floor(Date.now() / 1000);

  await putPasswordResetRecord({
    recordId,
    emailHash,
    codeHash,
    codeSalt,
    cognitoUsername: user.username,
    cognitoSub: user.cognitoSub,
    attemptCount: 0,
    requestedAt,
    expiresAt: requestedAt + TOKEN_TTL_SECONDS,
  });

  try {
    const emailContent = buildPasswordResetEmail(verificationCode);
    await sendEmail(
      user.email,
      emailContent.subject,
      emailContent.bodyHtml,
      emailContent.bodyText,
      process.env.SES_CONFIGURATION_SET_NAME,
    );
    logger.info('Password reset mail sent', {
      event: 'mail_sent',
      recordId,
    });
  } catch (error) {
    await deletePasswordResetRecord(recordId);
    logger.error('Password reset mail delivery failed', {
      event: 'mail_delivery_failed',
      recordId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
};

export const handler = createApiHandler(async (event) => {
  const startedAt = Date.now();

  try {
    const email = parseEmail(event.body);
    if (!email) {
      logger.info('Password reset request payload was invalid', {
        event: 'invalid_request',
      });
    } else {
      await processPasswordResetRequest(email);
    }
  } catch (error) {
    logger.error('Unexpected password reset request error', {
      event: 'unexpected_error',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  const remainingMs = getMinimumResponseMs() - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await sleep(remainingMs);
  }

  return {
    statusCode: 200,
    body: {},
  };
});
