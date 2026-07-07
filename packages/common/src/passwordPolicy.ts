import { z } from 'zod';

const COGNITO_SYMBOL_CHARACTERS = '^$*.[]{}()?"!@#%&/\\,><\':;|_~`+=-';
const COGNITO_PASSWORD_POLICY_MIN_LENGTH = 6;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const DIGITS_PATTERN = /[0-9]/;

const escapeForCharacterClass = (value: string): string => value.replace(/[[\]\\^-]/g, '\\$&');

const SYMBOL_PATTERN = new RegExp(`[${escapeForCharacterClass(COGNITO_SYMBOL_CHARACTERS)}]`);

const resolvedPasswordPolicySchema = z.object({
  minLength: z.number().int().min(COGNITO_PASSWORD_POLICY_MIN_LENGTH).max(99),
  requireLowercase: z.boolean(),
  requireUppercase: z.boolean(),
  requireDigits: z.boolean(),
  requireSymbols: z.boolean(),
});

export type PasswordPolicySettings = z.infer<typeof resolvedPasswordPolicySchema>;

export const DEFAULT_PASSWORD_POLICY: PasswordPolicySettings = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireDigits: true,
  requireSymbols: true,
};

export const passwordPolicyInputSchema = resolvedPasswordPolicySchema
  .partial()
  .default({})
  .transform(
    (input): PasswordPolicySettings => ({
      ...DEFAULT_PASSWORD_POLICY,
      ...input,
    }),
  );

const getPasswordRequirements = (policy: PasswordPolicySettings): string[] => {
  const requirements: string[] = [];

  if (policy.requireUppercase) {
    requirements.push('大文字');
  }
  if (policy.requireLowercase) {
    requirements.push('小文字');
  }
  if (policy.requireDigits) {
    requirements.push('数字');
  }
  if (policy.requireSymbols) {
    requirements.push('記号');
  }

  return requirements;
};

export const buildPasswordPolicyMessage = (policy: PasswordPolicySettings): string => {
  const requirements = getPasswordRequirements(policy);

  if (requirements.length === 0) {
    return `パスワードは${policy.minLength}文字以上で入力してください。`;
  }

  if (requirements.length === 1) {
    return `パスワードは${policy.minLength}文字以上で、${requirements[0]}を1文字以上含めてください。`;
  }

  return `パスワードは${policy.minLength}文字以上で、${requirements.join(
    '・',
  )}をそれぞれ1文字以上含めてください。`;
};

export const isPasswordPolicySatisfied = (
  value: string,
  policy: PasswordPolicySettings,
): boolean => {
  if (value.length < policy.minLength) {
    return false;
  }
  if (policy.requireUppercase && !UPPERCASE_PATTERN.test(value)) {
    return false;
  }
  if (policy.requireLowercase && !LOWERCASE_PATTERN.test(value)) {
    return false;
  }
  if (policy.requireDigits && !DIGITS_PATTERN.test(value)) {
    return false;
  }
  if (policy.requireSymbols && !SYMBOL_PATTERN.test(value)) {
    return false;
  }

  return true;
};

export const createPasswordPolicyStringSchema = (
  policy: PasswordPolicySettings,
  messages: {
    invalidMessage?: string;
  } = {},
) => {
  const invalidMessage = messages.invalidMessage ?? buildPasswordPolicyMessage(policy);

  return z.string({ error: invalidMessage }).superRefine((value, context) => {
    if (isPasswordPolicySatisfied(value, policy)) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message: invalidMessage,
    });
  });
};

export const parsePasswordPolicy = (value: unknown): PasswordPolicySettings => {
  if (value === undefined || value === '') {
    return DEFAULT_PASSWORD_POLICY;
  }

  return passwordPolicyInputSchema.parse(typeof value === 'string' ? JSON.parse(value) : value);
};
