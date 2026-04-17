import { CognitoIdentityClient, GetIdCommand } from '@aws-sdk/client-cognito-identity';

const client = new CognitoIdentityClient({});

const IDENTITY_POOL_ID = process.env.IDENTITY_POOL_ID!;
const USER_POOL_ID = process.env.USER_POOL_ID!;
const REGION = process.env.AWS_REGION!;

export async function resolveIdentityId(idToken: string): Promise<string> {
  const issuer = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

  const result = await client.send(
    new GetIdCommand({
      IdentityPoolId: IDENTITY_POOL_ID,
      Logins: {
        [issuer]: idToken,
      },
    }),
  );

  if (!result.IdentityId) {
    throw new Error('Failed to resolve Cognito Identity ID');
  }

  return result.IdentityId;
}
