import { Logger } from '@aws-lambda-powertools/logger';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { findExAppById } from './repository/exAppRepository';
import { createInvokeExAppHistory } from './repository/invokeHistoryRepository';
import { findTeamById } from './repository/teamRepository';
import { getApiKeyValue } from './utils/apiKey';
import { resolveIdentityId } from './utils/cognitoIdentity';
import { COMMON_TEAM_ID } from './utils/constants';
import { createResponse } from './utils/http';
import { HttpError } from './utils/httpError';
import { classifyErrorType, publishErrorMetrics, publishSuccessMetrics } from './utils/monitoring';
import { isSystemAdmin, isTeamUser } from './utils/teamRole';
import { truncate } from './utils/truncate';
import { generateStableUserId } from './utils/userIdentifier';

const logger = new Logger();
const sqsClient = new SQSClient({});
const POLLING_QUEUE_URL = process.env.POLLING_QUEUE_URL!;
const cloudWatchClient = new CloudWatchClient({});
const APP_ENV = process.env.APP_ENV || '';

// UUID v4形式のバリデーション用正規表現
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId: string = event.requestContext.authorizer!.claims['sub'];

  // Cognito subから安定IDを生成
  let stableUserId: string;
  try {
    stableUserId = await generateStableUserId(userId);
  } catch (error) {
    logger.error('Failed to generate stable user ID', error as Error);
    throw new HttpError(500, 'ユーザーID生成に失敗しました');
  }

  let teamId: string = '';
  let exAppId: string = '';
  let inputs: Record<string, any> = {};
  let responseBody: any = {};
  let status: 'ACCEPTED' | 'COMPLETED' | 'ERROR' = 'COMPLETED';
  const createdDate = `${Date.now()}`;
  let dbId = '';
  let baseS3Prefix = '';
  let sessionId: string | undefined;
  const requestStartTime = Date.now();

  try {
    if (!event.body) {
      throw new HttpError(400, 'Pathが不正か、bodyがありません');
    }

    let parsedBody: Record<string, any>;
    try {
      parsedBody = JSON.parse(event.body);
    } catch {
      throw new HttpError(400, 'リクエストボディのJSON形式が不正です。');
    }
    teamId = parsedBody.teamId;
    exAppId = parsedBody.exAppId;
    inputs = parsedBody.inputs;
    dbId = `${teamId}#${exAppId}#${userId}`;

    const authHeader = event.headers?.Authorization ?? event.headers?.authorization;
    const idToken = authHeader?.replace(/^Bearer\s+/i, '');
    if (!idToken) {
      throw new HttpError(401, 'Authorization header is required');
    }
    const cognitoId = await resolveIdentityId(idToken);
    baseS3Prefix = `${cognitoId}/${teamId}/${exAppId}/${createdDate}`;

    // sessionIdのバリデーション
    if (parsedBody.sessionId) {
      if (typeof parsedBody.sessionId === 'string' && UUID_V4_REGEX.test(parsedBody.sessionId)) {
        sessionId = parsedBody.sessionId;
      } else {
        logger.warn('Invalid sessionId format provided', { sessionId: parsedBody.sessionId });
        throw new HttpError(400, 'sessionIdはUUID v4形式である必要があります。');
      }
    }

    if (!teamId || !exAppId || !inputs) {
      throw new HttpError(400, 'パラメータが不正です。');
    }

    const isTeamUserResult = await isTeamUser(event, teamId);
    const isCommonOrTeamUser = teamId === COMMON_TEAM_ID || isTeamUserResult;
    if (!isSystemAdmin(event) && !isCommonOrTeamUser) {
      throw new HttpError(
        403,
        'チームメンバーではないため実行できません。権限を見直してください。',
      );
    }

    const res = await findExAppById(teamId, exAppId);
    if (!res) {
      throw new HttpError(404, 'リクエストされたAIアプリが見つかりませんでした。');
    }

    const apiKeyValue = await getApiKeyValue(teamId, exAppId, APP_ENV);
    if (!apiKeyValue) {
      throw new HttpError(404, 'リクエストされたAIアプリが見つかりませんでした。');
    }

    const requestBody: { inputs: Record<string, any>; sessionId?: string } = { inputs };
    if (sessionId) {
      requestBody.sessionId = sessionId;
    }
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeyValue,
        'x-user-id': stableUserId,
      },
      body: JSON.stringify(requestBody),
    };

    const response = await fetch(res.endpoint, options);

    try {
      responseBody = await response.json();
    } catch (e) {
      const textOutput = await response.text();
      logger.warn('Response was not valid JSON. Treating as plain text output.', {
        error: e,
        text: truncate(textOutput),
      });
      responseBody = {
        outputs: textOutput,
      };
    }

    if (response.status === 202 && responseBody.status_url) {
      status = 'ACCEPTED';

      const sqsMessage = {
        dbId,
        createdDate,
        teamId,
        exAppId,
        userId,
        stableUserId,
        statusUrl: responseBody.status_url,
        endpoint: res.endpoint,
        apiKeySecretId: `${teamId}/${exAppId}`,
        baseS3Prefix, // PrefixをSQSメッセージに追加
      };

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: POLLING_QUEUE_URL,
          MessageBody: JSON.stringify(sqsMessage),
        }),
      );

      return createResponse(202, JSON.stringify(responseBody));
    } else {
      const requestEndTime = Date.now();
      const responseTime = requestEndTime - requestStartTime;
      if (response.status >= 400) {
        status = 'ERROR';
        const errorType = classifyErrorType(response.status, responseBody);
        await publishErrorMetrics(cloudWatchClient, {
          exAppId,
          teamId,
          statusCode: response.status,
          endpoint: res.endpoint,
          responseTime,
          errorType,
          userId,
          envName: APP_ENV,
        });

        logger.error('ExApp invocation failed', {
          exAppId,
          teamId,
          statusCode: response.status,
          endpoint: res.endpoint,
          errorType,
          responseTime,
          errorMessage: responseBody?.error || responseBody?.message || 'Unknown error',
          userId,
          requestId: event.requestContext.requestId,
        });
      } else {
        await publishSuccessMetrics(cloudWatchClient, {
          exAppId,
          teamId,
          responseTime,
          endpoint: res.endpoint,
          statusCode: response.status,
          envName: APP_ENV,
        });
      }
      return createResponse(response.status, JSON.stringify(responseBody));
    }
  } catch (error) {
    logger.error('Error in invokeExApp', error as Error);
    status = 'ERROR';
    if (error instanceof HttpError) {
      responseBody = { outputs: error.message };
      return createResponse(error.statusCode, JSON.stringify(responseBody));
    } else {
      responseBody = { outputs: 'サーバ側でエラーが発生しました。管理者へご連絡ください。' };
      return createResponse(500, JSON.stringify(responseBody));
    }
  } finally {
    await createInvokeExAppHistory(
      dbId,
      createdDate,
      teamId,
      exAppId,
      userId,
      baseS3Prefix,
      inputs,
      responseBody,
      (await findTeamById(teamId))!.teamName,
      (await findExAppById(teamId, exAppId))!.exAppName,
      status,
      sessionId,
    );
  }
};
