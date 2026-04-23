import { InvokeInterface, PredictRequest } from 'genai-web';
import api from './utils/api';
import { createApiHandler } from './utils/createApiHandler';
import { defaultModel } from './utils/models';
import { parseJsonBody } from './utils/parseJsonBody';

export const handler = createApiHandler(async (event) => {
  const req = parseJsonBody(event.body) as PredictRequest;

  const model = req.model || defaultModel;

  const response = await (api[model.type] as { invoke?: InvokeInterface }).invoke?.(
    model,
    req.messages,
    req.id,
  );

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
