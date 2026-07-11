import { DEFAULT_PASSWORD_POLICY } from '@genai-web/common';
import { describe, expect, test } from 'vitest';
import { stackInputSchema } from '../lib/stack-input';

const baseParams = {
  account: '123456789012',
  region: 'ap-northeast-1',
  env: '-test',
  appEnv: 'test',
  allowedSignUpEmailDomains: null,
  closedNetworkDomainName: 'test.internal',
  closedNetworkCertificateArn:
    'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
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

describe('StackInput Closed Network validation', () => {
  const baseParams = {
    account: '123456789012',
    region: 'ap-northeast-1',
    env: '-test',
    appEnv: 'test',
    allowedSignUpEmailDomains: null,
  };

  test('rejects missing closedNetworkDomainName', () => {
    const input = {
      ...baseParams,
      closedNetworkCertificateArn:
        'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
    };
    expect(() => stackInputSchema.parse(input)).toThrow();
  });

  test('rejects missing closedNetworkCertificateArn', () => {
    const input = {
      ...baseParams,
      closedNetworkDomainName: 'test.internal',
    };
    expect(() => stackInputSchema.parse(input)).toThrow();
  });

  test('accepts valid closed network params', () => {
    const input = {
      ...baseParams,
      closedNetworkDomainName: 'test.internal',
      closedNetworkCertificateArn:
        'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
    };
    const result = stackInputSchema.parse(input);
    expect(result.closedNetworkDomainName).toBe('test.internal');
    expect(result.closedNetworkCertificateArn).toBe(
      'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
    );
    expect(result.closedNetworkVpcCidr).toBe('10.1.0.0/16');
  });

  test('accepts custom closedNetworkVpcCidr', () => {
    const input = {
      ...baseParams,
      closedNetworkVpcCidr: '10.42.0.0/16',
      closedNetworkDomainName: 'test.internal',
      closedNetworkCertificateArn:
        'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
    };
    const result = stackInputSchema.parse(input);
    expect(result.closedNetworkVpcCidr).toBe('10.42.0.0/16');
  });

  test('accepts existing privateHostedZoneId', () => {
    const input = {
      ...baseParams,
      closedNetworkDomainName: 'test.internal',
      closedNetworkCertificateArn:
        'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
      closedNetworkPrivateHostedZoneId: 'Z1234567890ABC',
    };
    const result = stackInputSchema.parse(input);
    expect(result.closedNetworkPrivateHostedZoneId).toBe('Z1234567890ABC');
  });
});

describe('StackInput closedNetworkAllowedClientCidrs', () => {
  const baseParams = {
    account: '123456789012',
    region: 'ap-northeast-1',
    env: '-test',
    appEnv: 'test',
    allowedSignUpEmailDomains: null,
    closedNetworkDomainName: 'test.internal',
    closedNetworkCertificateArn:
      'arn:aws:acm:ap-northeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000',
  };

  test('デフォルトは空配列（VPC 内からのみアクセス可能）', () => {
    const result = stackInputSchema.parse(baseParams);
    expect(result.closedNetworkAllowedClientCidrs).toEqual([]);
  });

  test('IPv4 CIDR のリストを受け付ける', () => {
    const input = {
      ...baseParams,
      closedNetworkAllowedClientCidrs: ['172.16.0.0/12', '192.168.10.0/24'],
    };
    const result = stackInputSchema.parse(input);
    expect(result.closedNetworkAllowedClientCidrs).toEqual(['172.16.0.0/12', '192.168.10.0/24']);
  });

  test('CIDR 表記でない値は拒否する', () => {
    const input = {
      ...baseParams,
      closedNetworkAllowedClientCidrs: ['172.16.0.0'], // プレフィックス長がない
    };
    expect(() => stackInputSchema.parse(input)).toThrow();
  });
});
