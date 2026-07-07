import { describe, expect, it } from 'vitest';
import {
  buildPasswordPolicyMessage,
  createPasswordPolicyStringSchema,
  DEFAULT_PASSWORD_POLICY,
  isPasswordPolicySatisfied,
  parsePasswordPolicy,
  passwordPolicyInputSchema,
  type PasswordPolicySettings,
} from '../src/passwordPolicy';

const COGNITO_SYMBOLS = [
  '^',
  '$',
  '*',
  '.',
  '[',
  ']',
  '{',
  '}',
  '(',
  ')',
  '?',
  '"',
  '!',
  '@',
  '#',
  '%',
  '&',
  '/',
  '\\',
  ',',
  '>',
  '<',
  "'",
  ':',
  ';',
  '|',
  '_',
  '~',
  '`',
  '=',
  '+',
  '-',
];

const symbolOnlyPolicy: PasswordPolicySettings = {
  minLength: 6,
  requireLowercase: false,
  requireUppercase: false,
  requireDigits: false,
  requireSymbols: true,
};

describe('passwordPolicyInputSchema', () => {
  it('applies default password policy when omitted', () => {
    expect(passwordPolicyInputSchema.parse(undefined)).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  it('merges partial overrides with defaults', () => {
    expect(
      passwordPolicyInputSchema.parse({
        minLength: 12,
        requireSymbols: false,
      }),
    ).toEqual({
      ...DEFAULT_PASSWORD_POLICY,
      minLength: 12,
      requireSymbols: false,
    });
  });

  it('rejects minLength lower than Cognito minimum', () => {
    expect(() =>
      passwordPolicyInputSchema.parse({
        minLength: 5,
      }),
    ).toThrow();
  });
});

describe('buildPasswordPolicyMessage', () => {
  it('builds the default password policy message', () => {
    expect(buildPasswordPolicyMessage(DEFAULT_PASSWORD_POLICY)).toBe(
      'パスワードは8文字以上で、大文字・小文字・数字・記号をそれぞれ1文字以上含めてください。',
    );
  });

  it('builds a single requirement message', () => {
    expect(
      buildPasswordPolicyMessage({
        minLength: 10,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      }),
    ).toBe('パスワードは10文字以上で、数字を1文字以上含めてください。');
  });

  it('builds a minimum-length-only message', () => {
    expect(
      buildPasswordPolicyMessage({
        minLength: 12,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      }),
    ).toBe('パスワードは12文字以上で入力してください。');
  });
});

describe('isPasswordPolicySatisfied', () => {
  it.each(COGNITO_SYMBOLS)('accepts Cognito symbol %s', (symbol) => {
    expect(isPasswordPolicySatisfied(`aaaaa${symbol}`, symbolOnlyPolicy)).toBe(true);
  });

  it('rejects space because it is not a Cognito password symbol', () => {
    expect(isPasswordPolicySatisfied('aaaaa ', symbolOnlyPolicy)).toBe(false);
  });

  it('rejects full-width symbols', () => {
    expect(isPasswordPolicySatisfied('aaaaa！', symbolOnlyPolicy)).toBe(false);
  });
});

describe('createPasswordPolicyStringSchema', () => {
  it('uses the invalid message for empty strings', () => {
    const schema = createPasswordPolicyStringSchema(DEFAULT_PASSWORD_POLICY, {
      invalidMessage: 'custom policy error',
    });

    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues[0]?.message).toBe('custom policy error');
  });

  it('accepts a password that satisfies the policy', () => {
    const schema = createPasswordPolicyStringSchema(DEFAULT_PASSWORD_POLICY);

    expect(schema.safeParse('NewPassword1!').success).toBe(true);
  });
});

describe('parsePasswordPolicy', () => {
  it('returns the default policy when env is undefined', () => {
    expect(parsePasswordPolicy(undefined)).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  it('parses JSON string input and merges defaults', () => {
    expect(
      parsePasswordPolicy(
        JSON.stringify({
          minLength: 14,
          requireSymbols: false,
        }),
      ),
    ).toEqual({
      ...DEFAULT_PASSWORD_POLICY,
      minLength: 14,
      requireSymbols: false,
    });
  });
});
