import {
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const originalEnv = process.env;

const loadCognito = async () => {
  vi.resetModules();
  return import('../../../lambda/passwordReset/cognito');
};

describe('findPasswordResetTargetUserByEmail', () => {
  beforeEach(() => {
    cognitoMock.reset();
    process.env = { ...originalEnv, USER_POOL_ID: 'ap-northeast-1_test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('有効なlocal userを返す', async () => {
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'username',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-123' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
          ],
        },
      ],
    });
    const { findPasswordResetTargetUserByEmail } = await loadCognito();

    const result = await findPasswordResetTargetUserByEmail('user@example.go.jp');

    expect(result).toEqual({
      username: 'username',
      cognitoSub: 'sub-123',
      email: 'user@example.go.jp',
    });
    expect(cognitoMock.commandCalls(ListUsersCommand)[0].args[0].input).toMatchObject({
      Filter: 'email="user@example.go.jp"',
      Limit: 60,
      UserPoolId: 'ap-northeast-1_test',
    });
  });

  test.each([
    {
      name: '複数eligible local user',
      users: [
        {
          Username: 'a',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-a' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
          ],
        },
        {
          Username: 'b',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-b' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
          ],
        },
      ],
    },
    {
      name: '無効ユーザー',
      users: [
        {
          Username: 'username',
          Enabled: false,
          Attributes: [
            { Name: 'sub', Value: 'sub-123' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
          ],
        },
      ],
    },
    {
      name: 'email未検証',
      users: [
        {
          Username: 'username',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-123' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'false' },
          ],
        },
      ],
    },
    {
      name: 'federated user',
      users: [
        {
          Username: 'SAML_user',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-123' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'identities', Value: '[{"providerName":"SAML"}]' },
          ],
        },
      ],
    },
  ])('$nameはundefinedを返す', async ({ users }) => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: users });
    const { findPasswordResetTargetUserByEmail } = await loadCognito();

    await expect(findPasswordResetTargetUserByEmail('user@example.go.jp')).resolves.toBeUndefined();
  });

  test('同一emailのfederated userがいてもeligible local userを返す', async () => {
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'SAML_user',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-saml' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'identities', Value: '[{"providerName":"SAML"}]' },
          ],
        },
        {
          Username: 'local-user',
          Enabled: true,
          Attributes: [
            { Name: 'sub', Value: 'sub-local' },
            { Name: 'email', Value: 'user@example.go.jp' },
            { Name: 'email_verified', Value: 'true' },
          ],
        },
      ],
    });
    const { findPasswordResetTargetUserByEmail } = await loadCognito();

    await expect(findPasswordResetTargetUserByEmail('user@example.go.jp')).resolves.toEqual({
      username: 'local-user',
      cognitoSub: 'sub-local',
      email: 'user@example.go.jp',
    });
  });
});

describe('password reset Cognito admin helpers', () => {
  beforeEach(() => {
    cognitoMock.reset();
    process.env = { ...originalEnv, USER_POOL_ID: 'ap-northeast-1_test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('permanent passwordを設定する', async () => {
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});
    const { setPasswordResetUserPassword } = await loadCognito();

    await setPasswordResetUserPassword('username', 'NewPassword!234');

    expect(cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0].args[0].input).toEqual({
      UserPoolId: 'ap-northeast-1_test',
      Username: 'username',
      Password: 'NewPassword!234',
      Permanent: true,
    });
  });

  test('対象ユーザーをglobal sign-outする', async () => {
    cognitoMock.on(AdminUserGlobalSignOutCommand).resolves({});
    const { signOutPasswordResetUser } = await loadCognito();

    await signOutPasswordResetUser('username');

    expect(cognitoMock.commandCalls(AdminUserGlobalSignOutCommand)[0].args[0].input).toEqual({
      UserPoolId: 'ap-northeast-1_test',
      Username: 'username',
    });
  });

  test('登録済みemailと検証状態を取得する', async () => {
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'username',
      UserAttributes: [
        { Name: 'email', Value: 'registered@example.go.jp' },
        { Name: 'email_verified', Value: 'true' },
      ],
    });
    const { getPasswordResetUserEmail } = await loadCognito();

    await expect(getPasswordResetUserEmail('username')).resolves.toEqual({
      email: 'registered@example.go.jp',
      emailVerified: true,
    });
  });

  test('emailがない場合はundefinedを返す', async () => {
    cognitoMock.on(AdminGetUserCommand).resolves({
      Username: 'username',
      UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
    });
    const { getPasswordResetUserEmail } = await loadCognito();

    await expect(getPasswordResetUserEmail('username')).resolves.toBeUndefined();
  });
});
