import { APIGatewayProxyEvent } from 'aws-lambda';
import { findTeamUserById } from '../repository/teamUserRepository';
import { GROUP_NAME } from './constants';

export const isSystemAdmin = (event: APIGatewayProxyEvent): boolean => {
  const groups: string = event.requestContext.authorizer!.claims['cognito:groups'];
  return groups.includes(GROUP_NAME.SystemAdminGroup);
};

export const isTeamAdmin = async (
  event: APIGatewayProxyEvent,
  teamId: string,
): Promise<boolean> => {
  const groups: string = event.requestContext.authorizer!.claims['cognito:groups'];
  const userId: string = event.requestContext.authorizer!.claims['sub'];

  const teamUser = await findTeamUserById(teamId, userId);
  if (!teamUser) {
    return false;
  }

  if (!teamUser.isAdmin) {
    return false;
  }

  return groups.includes(GROUP_NAME.TeamAdminGroup);
};

export const isTeamUser = async (event: APIGatewayProxyEvent, teamId: string): Promise<boolean> => {
  const groups: string = event.requestContext.authorizer!.claims['cognito:groups'];
  const userId: string = event.requestContext.authorizer!.claims['sub'];

  const teamUser = await findTeamUserById(teamId, userId);
  if (!teamUser) {
    return false;
  }

  return groups.includes(GROUP_NAME.UserGroup);
};
