import {
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  AttributeType,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersCommandInput,
  UserType,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();
const userPoolId = process.env.USER_POOL_ID;

export interface PasswordResetTargetUser {
  username: string;
  cognitoSub: string;
  email: string;
}

export interface PasswordResetUserEmail {
  email: string;
  emailVerified: boolean;
}

const getAttributeValue = (
  attributes: AttributeType[] | undefined,
  name: string,
): string | undefined => attributes?.find((attribute) => attribute.Name === name)?.Value;

const getUserAttribute = (user: UserType, name: string): string | undefined =>
  getAttributeValue(user.Attributes, name);

const escapeCognitoFilterValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const toPasswordResetTargetUser = (user: UserType): PasswordResetTargetUser | undefined => {
  if (!user.Username || !user.Enabled) {
    return undefined;
  }

  const userEmail = getUserAttribute(user, 'email');
  if (!userEmail) {
    return undefined;
  }

  const cognitoSub = getUserAttribute(user, 'sub');
  if (!cognitoSub) {
    return undefined;
  }

  const emailVerified = getUserAttribute(user, 'email_verified');
  if (emailVerified !== 'true') {
    return undefined;
  }

  const federatedIdentities = getUserAttribute(user, 'identities');
  if (federatedIdentities) {
    return undefined;
  }

  return {
    username: user.Username,
    cognitoSub,
    email: userEmail,
  };
};

export const findPasswordResetTargetUserByEmail = async (
  email: string,
): Promise<PasswordResetTargetUser | undefined> => {
  const input: ListUsersCommandInput = {
    Filter: `email="${escapeCognitoFilterValue(email)}"`,
    Limit: 60,
    UserPoolId: userPoolId,
  };

  const response = await client.send(new ListUsersCommand(input));
  const users = response.Users ?? [];
  const targetUsers = users.map(toPasswordResetTargetUser).filter((user) => user !== undefined);

  if (targetUsers.length !== 1) {
    return undefined;
  }

  return targetUsers[0];
};

export const setPasswordResetUserPassword = async (
  username: string,
  password: string,
): Promise<void> => {
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );
};

export const signOutPasswordResetUser = async (username: string): Promise<void> => {
  await client.send(
    new AdminUserGlobalSignOutCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );
};

export const getPasswordResetUserEmail = async (
  username: string,
): Promise<PasswordResetUserEmail | undefined> => {
  const response = await client.send(
    new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );
  const email = getAttributeValue(response.UserAttributes, 'email');
  if (!email) {
    return undefined;
  }

  return {
    email,
    emailVerified: getAttributeValue(response.UserAttributes, 'email_verified') === 'true',
  };
};
