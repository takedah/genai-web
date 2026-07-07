import { DEFAULT_PASSWORD_POLICY } from '@genai-web/common';
import { describe, expect, test } from 'vitest';
import { stackInputSchema } from '../lib/stack-input';

const baseParams = {
  account: '123456789012',
  region: 'ap-northeast-1',
  env: '-test',
  appEnv: 'test',
  allowedSignUpEmailDomains: null,
  allowedIpV4AddressRanges: null,
  allowedIpV6AddressRanges: null,
};

describe('StackInput databaseRemovalPolicy', () => {
  test('accepts DESTROY value', () => {
    const input = {
      ...baseParams,
      databaseRemovalPolicy: 'DESTROY',
    };
    const result = stackInputSchema.parse(input);
    expect(result.databaseRemovalPolicy).toBe('DESTROY');
  });

  test('accepts RETAIN value', () => {
    const input = {
      ...baseParams,
      databaseRemovalPolicy: 'RETAIN',
    };
    const result = stackInputSchema.parse(input);
    expect(result.databaseRemovalPolicy).toBe('RETAIN');
  });

  test('rejects invalid value', () => {
    const input = {
      ...baseParams,
      databaseRemovalPolicy: 'DELETE',
    };
    expect(() => stackInputSchema.parse(input)).toThrow();
  });

  test('applies default DESTROY when not specified', () => {
    const result = stackInputSchema.parse(baseParams);
    expect(result.databaseRemovalPolicy).toBe('DESTROY');
  });
});

describe('StackInput passwordPolicy', () => {
  test('applies current default password policy when omitted', () => {
    const result = stackInputSchema.parse(baseParams);
    expect(result.passwordPolicy).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  test('merges partial password policy overrides with defaults', () => {
    const result = stackInputSchema.parse({
      ...baseParams,
      passwordPolicy: {
        minLength: 12,
        requireSymbols: false,
      },
    });

    expect(result.passwordPolicy).toEqual({
      ...DEFAULT_PASSWORD_POLICY,
      minLength: 12,
      requireSymbols: false,
    });
  });

  test('rejects too short password policy minLength', () => {
    expect(() =>
      stackInputSchema.parse({
        ...baseParams,
        passwordPolicy: {
          minLength: 5,
        },
      }),
    ).toThrow();
  });
});

describe('StackInput SAML validation', () => {
  test('rejects samlAuthEnabled=true without primaryProviderName', () => {
    const input = {
      ...baseParams,
      samlAuthEnabled: true,
    };
    expect(() => stackInputSchema.parse(input)).toThrow(
      'samlCognitoFederatedIdentityPrimaryProviderName is required when samlAuthEnabled is true',
    );
  });

  test('rejects samlAuthEnabled=true with empty string primaryProviderName', () => {
    const input = {
      ...baseParams,
      samlAuthEnabled: true,
      samlCognitoFederatedIdentityPrimaryProviderName: '',
    };
    expect(() => stackInputSchema.parse(input)).toThrow(
      'samlCognitoFederatedIdentityPrimaryProviderName is required when samlAuthEnabled is true',
    );
  });

  test('accepts samlAuthEnabled=true with primaryProviderName', () => {
    const input = {
      ...baseParams,
      samlAuthEnabled: true,
      samlCognitoFederatedIdentityPrimaryProviderName: 'EntraID',
    };
    const result = stackInputSchema.parse(input);
    expect(result.samlAuthEnabled).toBe(true);
    expect(result.samlCognitoFederatedIdentityPrimaryProviderName).toBe('EntraID');
  });

  test('accepts samlAuthEnabled=false without primaryProviderName', () => {
    const input = {
      ...baseParams,
      samlAuthEnabled: false,
    };
    const result = stackInputSchema.parse(input);
    expect(result.samlAuthEnabled).toBe(false);
  });
});
