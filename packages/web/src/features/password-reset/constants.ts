import { buildPasswordPolicyMessage, parsePasswordPolicy } from '@genai-web/common';

export const PASSWORD_RESET_REQUEST_PATH = '/password-reset/request';
export const PASSWORD_RESET_COMPLETE_PATH = '/password-reset/complete';

export const PASSWORD_RESET_COMPLETE_SUCCESS_MESSAGE =
  'パスワードを更新しました。新しいパスワードでサインインしてください。';

export const PASSWORD_RESET_INVALID_CODE_MESSAGE =
  '認証コードが正しくないか、有効期限が切れています。';

export const PASSWORD_POLICY = parsePasswordPolicy(import.meta.env.VITE_APP_PASSWORD_POLICY);
export const PASSWORD_POLICY_ERROR_MESSAGE = buildPasswordPolicyMessage(PASSWORD_POLICY);
export const PASSWORD_POLICY_SUPPORT_TEXT = PASSWORD_POLICY_ERROR_MESSAGE;

export const isCustomPasswordResetEnabled = (
  emailMfaRequired: boolean,
  samlAuthEnabled: boolean,
): boolean => emailMfaRequired && !samlAuthEnabled;
