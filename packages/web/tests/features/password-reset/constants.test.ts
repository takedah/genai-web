import { describe, expect, it } from 'vitest';
import {
  isCustomPasswordResetEnabled,
  PASSWORD_POLICY,
  PASSWORD_POLICY_ERROR_MESSAGE,
  PASSWORD_POLICY_SUPPORT_TEXT,
} from '@/features/password-reset/constants';

describe('password reset constants', () => {
  it('enables custom password reset only for email MFA user pool tenants', () => {
    expect(isCustomPasswordResetEnabled(true, false)).toBe(true);
    expect(isCustomPasswordResetEnabled(false, false)).toBe(false);
    expect(isCustomPasswordResetEnabled(true, true)).toBe(false);
  });

  it('uses the current default password policy when env is not provided', () => {
    expect(PASSWORD_POLICY).toEqual({
      minLength: 8,
      requireLowercase: true,
      requireUppercase: true,
      requireDigits: true,
      requireSymbols: true,
    });
    expect(PASSWORD_POLICY_ERROR_MESSAGE).toBe(
      'パスワードは8文字以上で、大文字・小文字・数字・記号をそれぞれ1文字以上含めてください。',
    );
    expect(PASSWORD_POLICY_SUPPORT_TEXT).toBe(PASSWORD_POLICY_ERROR_MESSAGE);
  });
});
