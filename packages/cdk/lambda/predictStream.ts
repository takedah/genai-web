import { Context, Handler } from 'aws-lambda';
import { PredictRequest } from 'genai-web';
import { isModelNotAllowedError, resolveAllowedTextModel } from './utils/allowedModels';
import api from './utils/api';
import { writeModelNotAllowedStream } from './utils/modelNotAllowedStream';

declare global {
  namespace awslambda {
    function streamifyResponse(
      f: (
        event: PredictRequest,
        responseStream: NodeJS.WritableStream,
        context: Context,
      ) => Promise<void>,
    ): Handler;
  }
}

export const predictStreamHandler = async (
  event: PredictRequest,
  responseStream: NodeJS.WritableStream,
  context: Context,
) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const model = resolveAllowedTextModel(event.model);
    // 添付ファイルの S3 取得時に所有者チェックへ使う Cognito Identity ID。
    // InvokeWithResponseStreamCommand 経由の呼び出しで context.identity に伝播する。
    const identityId = context.identity?.cognitoIdentityId;
    for await (const token of api[model.type].invokeStream?.(
      model,
      event.messages,
      event.id,
      identityId,
    ) ?? []) {
      responseStream.write(token);
    }
  } catch (error) {
    if (isModelNotAllowedError(error)) {
      writeModelNotAllowedStream(responseStream);
      return;
    }
    throw error;
  }

  responseStream.end();
};

export const handler = awslambda.streamifyResponse(predictStreamHandler);
